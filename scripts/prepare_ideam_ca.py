#!/usr/bin/env python3
"""Construye una cadena CA temporal para IDEAM sin relajar la validación TLS.

El servidor de puntos de calor puede omitir certificados intermedios. Este
script obtiene la cadena presentada, sigue las URL CA Issuers declaradas en
los propios certificados y solo genera un bundle si OpenSSL valida el sitio
contra las raíces confiables del sistema y el nombre DNS esperado.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


DEFAULT_HOST = "puntosdecalor.ideam.gov.co"
SYSTEM_CA_CANDIDATES = (
    Path("/etc/ssl/certs/ca-certificates.crt"),
    Path("/etc/pki/tls/certs/ca-bundle.crt"),
    Path("/etc/ssl/ca-bundle.pem"),
)
PEM_PATTERN = re.compile(
    rb"-----BEGIN CERTIFICATE-----\s+.*?-----END CERTIFICATE-----",
    re.DOTALL,
)
AIA_PATTERN = re.compile(r"CA Issuers\s*-\s*URI:([^\s]+)")


class CertificateError(RuntimeError):
    """La cadena no pudo completarse o verificarse con seguridad."""


def run_command(command: list[str], *, input_bytes: bytes | None = None) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        command,
        input=input_bytes,
        capture_output=True,
        check=False,
    )


def certificate_blocks(content: bytes) -> list[bytes]:
    return [match.group(0) + b"\n" for match in PEM_PATTERN.finditer(content)]


def find_system_ca_bundle() -> Path:
    for candidate in SYSTEM_CA_CANDIDATES:
        if candidate.is_file():
            return candidate
    raise CertificateError("no se encontró el almacén CA del sistema")


def write_certificate(path: Path, content: bytes) -> None:
    path.write_bytes(content if content.endswith(b"\n") else content + b"\n")


def openssl_text(certificate: Path, *arguments: str) -> str:
    completed = run_command(["openssl", "x509", "-in", str(certificate), *arguments])
    if completed.returncode != 0:
        detail = completed.stderr.decode("utf-8", errors="replace").strip()
        raise CertificateError(f"OpenSSL no pudo leer {certificate.name}: {detail}")
    return completed.stdout.decode("utf-8", errors="replace").strip()


def certificate_fingerprint(certificate: Path) -> str:
    output = openssl_text(certificate, "-noout", "-fingerprint", "-sha256")
    return output.partition("=")[2].replace(":", "").lower()


def certificate_identity(certificate: Path) -> dict[str, str]:
    output = openssl_text(certificate, "-noout", "-subject", "-issuer")
    values: dict[str, str] = {}
    for line in output.splitlines():
        key, separator, value = line.partition("=")
        if separator:
            values[key.strip()] = value.strip()
    return values


def aia_issuer_urls(certificate: Path) -> list[str]:
    output = openssl_text(certificate, "-noout", "-text")
    return AIA_PATTERN.findall(output)


def retrieve_server_chain(host: str, port: int) -> list[bytes]:
    completed = run_command(
        [
            "openssl",
            "s_client",
            "-connect",
            f"{host}:{port}",
            "-servername",
            host,
            "-showcerts",
        ],
        input_bytes=b"",
    )
    blocks = certificate_blocks(completed.stdout)
    if not blocks:
        detail = completed.stderr.decode("utf-8", errors="replace").strip()
        raise CertificateError(f"el servidor no presentó certificados: {detail}")
    return blocks


def download_issuer(url: str, destination: Path) -> None:
    completed = run_command(
        [
            "curl",
            "--fail",
            "--location",
            "--silent",
            "--show-error",
            "--connect-timeout",
            "15",
            "--max-time",
            "45",
            "--output",
            str(destination),
            url,
        ]
    )
    if completed.returncode != 0 or not destination.is_file() or destination.stat().st_size == 0:
        detail = completed.stderr.decode("utf-8", errors="replace").strip()
        raise CertificateError(f"no fue posible obtener el emisor declarado: {detail}")


def convert_to_pem(source: Path, destination: Path) -> None:
    for input_format in ("DER", "PEM"):
        completed = run_command(
            [
                "openssl",
                "x509",
                "-inform",
                input_format,
                "-in",
                str(source),
                "-out",
                str(destination),
                "-outform",
                "PEM",
            ]
        )
        if completed.returncode == 0:
            return
    raise CertificateError("el emisor descargado no es un certificado X.509 válido")


def verify_chain(host: str, leaf: Path, chain: list[Path], system_ca: Path) -> tuple[bool, str]:
    command = [
        "openssl",
        "verify",
        "-purpose",
        "sslserver",
        "-verify_hostname",
        host,
        "-CAfile",
        str(system_ca),
    ]
    if chain:
        chain_path = leaf.parent / "untrusted-chain.pem"
        chain_path.write_bytes(b"".join(path.read_bytes() for path in chain))
        command.extend(["-untrusted", str(chain_path)])
    command.append(str(leaf))
    completed = run_command(command)
    detail = (completed.stdout + completed.stderr).decode("utf-8", errors="replace").strip()
    return completed.returncode == 0, detail


def build_verified_bundle(host: str, port: int, output: Path, max_issuers: int = 4) -> dict[str, object]:
    if not shutil.which("openssl") or not shutil.which("curl"):
        raise CertificateError("se requieren openssl y curl")
    system_ca = find_system_ca_bundle()

    with tempfile.TemporaryDirectory(prefix="ideam-ca-") as temp_name:
        temp_dir = Path(temp_name)
        presented = retrieve_server_chain(host, port)
        leaf = temp_dir / "leaf.pem"
        write_certificate(leaf, presented[0])
        chain: list[Path] = []
        fingerprints = {certificate_fingerprint(leaf)}

        for index, block in enumerate(presented[1:], start=1):
            path = temp_dir / f"presented-{index}.pem"
            write_certificate(path, block)
            fingerprint = certificate_fingerprint(path)
            if fingerprint not in fingerprints:
                fingerprints.add(fingerprint)
                chain.append(path)

        verified, verification = verify_chain(host, leaf, chain, system_ca)
        downloaded_urls: list[str] = []
        current = chain[-1] if chain else leaf
        issuer_number = 0
        while not verified and issuer_number < max_issuers:
            urls = aia_issuer_urls(current)
            if not urls:
                raise CertificateError(
                    f"cadena incompleta y certificado sin CA Issuers; verificación: {verification}"
                )
            last_error: Exception | None = None
            added = False
            for url in urls:
                source = temp_dir / f"issuer-{issuer_number}.download"
                candidate = temp_dir / f"issuer-{issuer_number}.pem"
                try:
                    download_issuer(url, source)
                    convert_to_pem(source, candidate)
                    fingerprint = certificate_fingerprint(candidate)
                    if fingerprint in fingerprints:
                        continue
                    fingerprints.add(fingerprint)
                    chain.append(candidate)
                    current = candidate
                    downloaded_urls.append(url)
                    issuer_number += 1
                    added = True
                    break
                except CertificateError as exc:
                    last_error = exc
            if not added:
                raise CertificateError(
                    f"ningún emisor AIA nuevo fue aceptado: {last_error or 'cadena circular'}"
                )
            verified, verification = verify_chain(host, leaf, chain, system_ca)

        if not verified:
            raise CertificateError(f"la cadena no alcanzó una raíz confiable: {verification}")

        output.parent.mkdir(parents=True, exist_ok=True)
        bundle = system_ca.read_bytes()
        if not bundle.endswith(b"\n"):
            bundle += b"\n"
        bundle += b"".join(path.read_bytes() for path in chain)
        output.write_bytes(bundle)

        return {
            "host": host,
            "port": port,
            "leaf": certificate_identity(leaf),
            "presented_certificates": len(presented),
            "trusted_intermediates": len(chain),
            "aia_issuers_downloaded": len(downloaded_urls),
            "aia_urls": downloaded_urls,
            "system_ca_bundle": str(system_ca),
            "output": str(output),
            "verification": verification,
            "tls_verification_disabled": False,
        }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=443)
    parser.add_argument("--output", type=Path, required=True)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        audit = build_verified_bundle(args.host, args.port, args.output)
    except CertificateError as exc:
        print(json.dumps({"status": "failed", "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1
    print(json.dumps({"status": "verified", **audit}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
