import unittest
from lab import validate_record, completed_minutes, roundtrip
class DataTests(unittest.TestCase):
 def test_roundtrip_preserves_unicode_and_completion(self):
  rows=[{"title":"课程", "minutes":6, "done":True},{"title":"Git", "minutes":8, "done":False}]
  self.assertEqual(roundtrip(rows),rows)
  self.assertEqual(completed_minutes(roundtrip(rows)),6)
 def test_empty_total(self):
  self.assertEqual(completed_minutes([]),0)
 def test_reject_invalid_types_ranges_and_fields(self):
  good={"title":"课", "minutes":6, "done":False}
  for patch in [{"minutes":True},{"minutes":-1},{"done":"false"},{"title":" "},{"extra":1}]:
   with self.subTest(patch=patch),self.assertRaises(ValueError):validate_record({**good,**patch})
