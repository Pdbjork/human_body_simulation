"""Exercise the real local HTTP handler with synthetic files, never health data."""
import http.client
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

from server import BodySimHandler


class PrivacyServerTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        root = Path(self.directory.name)
        (root / 'index.html').write_text('<h1>Test application</h1>')
        (root / 'js').mkdir()
        (root / 'js' / 'main.js').write_text('export const safe = true;')
        (root / 'data').mkdir()
        (root / 'data' / 'user_aggregate.json').write_text('{"private":"synthetic"}')
        (root / '.git').mkdir()
        (root / '.git' / 'config').write_text('synthetic-secret')
        (root / 'js' / 'private.js').symlink_to(root / '.git' / 'config')
        self.patch = patch('server.ROOT', root)
        self.patch.start()
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), BodySimHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.patch.stop()
        self.directory.cleanup()

    def request(self, method, path, body=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        connection.request(method, path, body=body)
        response = connection.getresponse()
        result = (response.status, dict(response.getheaders()), response.read())
        connection.close()
        return result

    def test_private_files_and_traversal_are_not_served(self):
        for path in ('/.git/config', '/data/user_aggregate.json', '/%2e%2e/server.py', '/js/../.git/config', '/js/private.js', '/server.py'):
            with self.subTest(path=path):
                status, _, body = self.request('GET', path)
                self.assertEqual(status, 404)
                self.assertNotIn(b'synthetic-secret', body)

    def test_health_upload_routes_refuse_bodies(self):
        for route in ('/api/contribute', '/api/update-knowledge', '/api/imaging', '/api/chat'):
            with self.subTest(route=route):
                self.assertEqual(self.request('POST', route, '{"synthetic":"data"}')[0], 405)

    def test_static_surface_has_no_store_and_external_connection_restrictions(self):
        status, headers, body = self.request('GET', '/js/main.js')
        self.assertEqual(status, 200)
        self.assertIn(b'export const safe', body)
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.assertIn("connect-src 'self'", headers['Content-Security-Policy'])
        self.assertIn("object-src 'none'", headers['Content-Security-Policy'])
        self.assertEqual(headers['Referrer-Policy'], 'no-referrer')


if __name__ == '__main__':
    unittest.main()
