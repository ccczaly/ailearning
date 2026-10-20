import unittest
from lab import cosine,search,grounded_answer,rrf,recall_at_k
class RetrievalTests(unittest.TestCase):
 def test_permissions_filter_before_ranking(self):
  self.assertNotIn("internal",[x["id"] for x in search("测验内部评价",role="student",limit=10)])
  self.assertIn("internal",[x["id"] for x in search("测验内部评价",role="staff",limit=10)])
 def test_unknown_question_refuses_and_hits_are_cited(self):
  self.assertIn("未找到",grounded_answer(search("证书价格",role="student")))
  self.assertIn("course-guide@1#",grounded_answer(search("测验通过",role="student")))
 def test_vectors_zero_dimension_and_nonfinite(self):
  self.assertEqual(cosine([1,0],[2,0]),1)
  self.assertEqual(cosine([0,0],[1,0]),0)
  for a,b in [([1],[1,2]),([float("nan")],[1])]:
   with self.assertRaises(ValueError):cosine(a,b)
 def test_rrf_does_not_count_duplicate_twice(self):
  self.assertEqual(rrf([["a","a"]]),rrf([["a"]]))
 def test_recall_is_set_based(self):
  self.assertEqual(recall_at_k({"a","b"},["a","a","b"],2),.5)
  self.assertEqual(recall_at_k(set(),["a"],1),0)
