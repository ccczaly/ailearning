import unittest
from lab import authorized,cache_key,pass_rate,safe_event
class QualityTests(unittest.TestCase):
 def test_identity_cannot_cross_owner(self):
  self.assertTrue(authorized("alice","alice"));self.assertFalse(authorized("bob","alice"));self.assertFalse(authorized("", ""))
 def test_cache_isolates_user_and_content_version(self):
  key=cache_key("alice","p1","d1","问题")
  self.assertNotEqual(key,cache_key("bob","p1","d1","问题"))
  self.assertNotEqual(key,cache_key("alice","p1","d2","问题"))
 def test_empty_eval_has_no_invented_rate(self):
  self.assertIsNone(pass_rate([])["rate"])
  self.assertEqual(pass_rate([True,False])["rate"],.5)
  with self.assertRaises(ValueError):pass_rate(["true"])
 def test_logging_accepts_only_explicit_fields(self):
  self.assertEqual(set(safe_event("r1","retrieve","ok",2)),{"request_id","stage","status","duration_ms"})
  for value in [-1,float("inf"),float("nan")]:
   with self.assertRaises(ValueError):safe_event("r1","retrieve","ok",value)
