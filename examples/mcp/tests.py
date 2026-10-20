import json,subprocess,sys,unittest
from pathlib import Path
from lab import Server,demo_exchange
class ProtocolTests(unittest.TestCase):
 def test_subprocess_handshake_and_notification_no_response(self):
  responses=demo_exchange()
  self.assertEqual([item["id"] for item in responses],[1,2,3])
  self.assertEqual(responses[0]["result"]["protocolVersion"],"2025-11-25")
  self.assertFalse(responses[-1]["result"]["isError"])
 def test_before_initialization_is_rejected(self):
  result=Server().handle({"jsonrpc":"2.0","id":1,"method":"tools/list"})
  self.assertEqual(result["error"]["code"],-32000)
 def test_resource_paths_and_tool_errors_are_distinct(self):
  calls=[{"jsonrpc":"2.0","id":4,"method":"resources/read","params":{"uri":"file:///secret"}},
   {"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"course_summary","arguments":{"code":"unknown"}}},
   {"jsonrpc":"2.0","id":6,"method":"prompts/get","params":{"name":"review","arguments":{"topic":"检索"}}}]
  result=demo_exchange(calls)
  self.assertIn("error",result[-3]);self.assertTrue(result[-2]["result"]["isError"])
  self.assertEqual(result[-1]["result"]["messages"][0]["role"],"user")
 def test_parse_error_does_not_break_next_message(self):
  result=subprocess.run([sys.executable,str(Path(__file__).with_name("lab.py")),"serve"],input="not-json\n"+json.dumps({"jsonrpc":"2.0","id":9,"method":"ping"})+"\n",text=True,encoding="utf-8",capture_output=True,timeout=5,check=True)
  responses=[json.loads(line) for line in result.stdout.splitlines()]
  self.assertEqual(responses[0]["error"]["code"],-32700)
  self.assertEqual(responses[1]["result"],{})
