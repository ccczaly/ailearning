import unittest
from lab import crop_box,audio_demo,sample_times,overlap
class MediaTests(unittest.TestCase):
 def test_out_of_bounds_and_boolean_coordinates_rejected(self):
  self.assertEqual(crop_box(100,100,0,0,50,60)["width"],50)
  for values in [(100,100,0,0,101,60),(100,100,True,0,50,60)]:
   with self.assertRaises(ValueError):crop_box(*values)
 def test_generated_audio_roundtrip(self):
  result=audio_demo();self.assertEqual(result["seconds"],1);self.assertEqual(result["channels"],1)
 def test_sampling_has_bounds_and_rejects_invalid_rate(self):
  self.assertEqual(sample_times(12,3),[0,3,6,9])
  for rate in [0,-1,float("nan")]:
   with self.assertRaises(ValueError):sample_times(10,rate)
 def test_half_open_intervals_and_invalid_ranges(self):
  self.assertEqual(overlap((2,5),(4,7)),1)
  self.assertEqual(overlap((2,4),(4,7)),0)
  with self.assertRaises(ValueError):overlap((5,2),(1,2))
