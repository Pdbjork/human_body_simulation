import http.server
import socketserver
import json
import os
import random

PORT = 8000
DATA_DIR = 'data'
KNOWLEDGE_FILE = os.path.join(DATA_DIR, 'knowledge_base.json')
USER_AGG_FILE = os.path.join(DATA_DIR, 'user_aggregate.json')

# Ensure data dir exists
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# Initialize files if missing
if not os.path.exists(KNOWLEDGE_FILE):
    initial_knowledge = {
        "heartRateResponse": 1.0, # Multiplier
        "adrenalineDecay": 5.0,
        "glucoseMetabolism": 1.0,
        "researchVersion": 1
    }
    with open(KNOWLEDGE_FILE, 'w') as f:
        json.dump(initial_knowledge, f)

if not os.path.exists(USER_AGG_FILE):
    initial_agg = {
        "totalUsers": 0,
        "avgRestingHR": 70,
        "totalStepsRecorded": 0
    }
    with open(USER_AGG_FILE, 'w') as f:
        json.dump(initial_agg, f)

class BodySimHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/parameters':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            with open(KNOWLEDGE_FILE, 'r') as f:
                self.wfile.write(f.read().encode())
        elif self.path == '/api/aggregate':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            with open(USER_AGG_FILE, 'r') as f:
                self.wfile.write(f.read().encode())
        else:
            # Fallback to serving static files
            super().do_GET()

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        if self.path == '/api/contribute':
            try:
                data = json.loads(post_data.decode('utf-8'))
                
                # Simple aggregation logic
                with open(USER_AGG_FILE, 'r+') as f:
                    agg = json.load(f)
                    
                    # Weighted average update
                    count = agg['totalUsers']
                    current_avg = agg['avgRestingHR']
                    new_val = data.get('restingHeartRate', 70)
                    
                    if new_val:
                        agg['avgRestingHR'] = int(((current_avg * count) + new_val) / (count + 1))
                        agg['totalUsers'] += 1
                    
                    steps = data.get('averageSteps', 0)
                    agg['totalStepsRecorded'] += steps
                    
                    f.seek(0)
                    json.dump(agg, f)
                    f.truncate()
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "newAverage": agg['avgRestingHR']}).encode())
                
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode())

        elif self.path == '/api/update-knowledge':
            # Simulated Research Scraper update
            try:
                with open(KNOWLEDGE_FILE, 'r+') as f:
                    kb = json.load(f)
                    # Simulate finding new data
                    kb['researchVersion'] += 1
                    kb['heartRateResponse'] = round(random.uniform(0.9, 1.2), 2)
                    kb['adrenalineDecay'] = round(random.uniform(4.0, 6.0), 1)
                    
                    f.seek(0)
                    json.dump(kb, f)
                    f.truncate()
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "updated", "data": kb}).encode())
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode())
        else:
            self.send_response(404)
            self.end_headers()

print(f"Starting Knowledge Server on port {PORT}...")
with socketserver.TCPServer(("", PORT), BodySimHandler) as httpd:
    httpd.serve_forever()
