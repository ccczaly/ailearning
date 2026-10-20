import unittest
from lab import dispatch,run_plan,Ledger,Proposal
class AgentTests(unittest.TestCase):
 def test_tool_whitelist_and_validation(self):
  self.assertEqual(dispatch("add_minutes",{"values":[6,8]})["total_minutes"],14)
  for name,args in [("shell",{}),("add_minutes",{"values":[True]}),("add_minutes",{"values":[1]*11})]:
   with self.assertRaises(ValueError):dispatch(name,args)
 def test_budget_and_failure_never_claim_success(self):
  action={"name":"add_minutes","arguments":{"values":[6]}}
  result=run_plan([action]*3,max_steps=2)
  self.assertEqual(result["status"],"budget_exhausted")
  self.assertEqual(len(result["trace"]),2)
  self.assertEqual(run_plan([{"name":"unknown","arguments":{}}])["status"],"failed")
 def test_idempotency_and_payload_conflict(self):
  ledger=Ledger();first=ledger.create("id",{"title":"复习"})
  first["payload"]["title"]="修改返回值"
  self.assertEqual(ledger.create("id",{"title":"复习"})["payload"]["title"],"复习")
  self.assertEqual(len(ledger.records),1)
  with self.assertRaises(ValueError):ledger.create("id",{"title":"另一操作"})
 def test_approval_is_required_and_content_cannot_mutate(self):
  draft=Proposal({"title":"复习"})
  with self.assertRaises(ValueError):draft.execute()
  copy=draft.content;copy["title"]="变更"
  self.assertEqual(draft.content["title"],"复习")
  draft.approve();self.assertEqual(draft.execute()["state"],"executed")
  with self.assertRaises(ValueError):draft.execute()
