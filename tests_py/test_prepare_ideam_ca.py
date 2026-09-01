import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "prepare_ideam_ca", ROOT / "scripts" / "prepare_ideam_ca.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class CertificatePreparationTests(unittest.TestCase):
    def test_extracts_all_pem_certificates(self):
        payload = (
            b"noise\n-----BEGIN CERTIFICATE-----\nAAA=\n-----END CERTIFICATE-----\n"
            b"-----BEGIN CERTIFICATE-----\nBBB=\n-----END CERTIFICATE-----\nnoise"
        )
        blocks = MODULE.certificate_blocks(payload)
        self.assertEqual(len(blocks), 2)
        self.assertTrue(blocks[0].endswith(b"\n"))

    def test_extracts_only_ca_issuer_urls(self):
        output = """
            Authority Information Access:
                OCSP - URI:http://ocsp.example.test
                CA Issuers - URI:http://crt.example.test/intermediate.crt
                CA Issuers - URI:https://crt.example.test/alternate.pem
        """
        self.assertEqual(
            MODULE.AIA_PATTERN.findall(output),
            [
                "http://crt.example.test/intermediate.crt",
                "https://crt.example.test/alternate.pem",
            ],
        )

    def test_system_ca_bundle_is_available_on_runner_family(self):
        self.assertTrue(MODULE.find_system_ca_bundle().is_file())


if __name__ == "__main__":
    unittest.main()
