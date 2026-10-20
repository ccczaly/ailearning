import unittest
from lab import backup_demo,migration_demo,readiness,release_gate
class DeploymentTests(unittest.TestCase):
 def test_backup_actually_restores_rows(self):
  result=backup_demo();self.assertEqual(result["rows"],[(1,"RAG")]);self.assertEqual(result["restored_count"],1)
 def test_compatible_migration_preserves_old_data(self):
  self.assertEqual(migration_demo(),[(1,"RAG",6)])
 def test_readiness_separates_dependency_failure(self):
  self.assertTrue(readiness(True)["accept_traffic"]);self.assertFalse(readiness(False)["accept_traffic"])
  with self.assertRaises(ValueError):readiness("false")
 def test_release_blocks_missing_condition(self):
  self.assertEqual(release_gate(True,True,True),"allow")
  for values in [(False,True,True),(True,False,True),(True,True,False)]:
   self.assertEqual(release_gate(*values),"stop")
