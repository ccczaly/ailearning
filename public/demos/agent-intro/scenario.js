// LearnAI teaching scenario. The browser displays these fixtures; it does not run Python.
// The accompanying Node test executes all three versions with Python's unittest.
export const CODE_FIXTURES = {
  projectRules: `# 项目约定（AGENTS.md）
- Python 3.11 及以上，使用标准库 unittest 测试。
- 金额统一使用 Decimal，cart_total 始终返回 Decimal。
- 保持 cart_total(items) 的函数接口不变。`,
  initial: `def cart_total(items):
    return sum(item["price"] for item in items)
`,
  firstPatch: `from decimal import Decimal

def cart_total(items):
    return sum(
        Decimal(str(item["price"])) * item["quantity"]
        for item in items
    )
`,
  final: `from decimal import Decimal

def cart_total(items):
    return sum(
        (Decimal(str(item["price"])) * item["quantity"]
         for item in items),
        Decimal("0.00"),
    )
`,
  tests: `import unittest
from decimal import Decimal
from cart import cart_total

class CartTotalTests(unittest.TestCase):
    def test_quantity(self):
        items = [{"price": "19.90", "quantity": 2}]
        self.assertEqual(cart_total(items), Decimal("39.80"))

    def test_empty_returns_decimal(self):
        total = cart_total([])
        self.assertIsInstance(total, Decimal)
        self.assertEqual(total, Decimal("0.00"))

    def test_decimal_exact(self):
        items = [{"price": "0.10", "quantity": 3},
                 {"price": "0.20", "quantity": 1}]
        self.assertEqual(cart_total(items), Decimal("0.50"))

if __name__ == "__main__":
    unittest.main()
`,
};

export const SCENARIO = {
  id: 'repair-cart-total',
  title: '一次代码修复，Agent 怎样把任务做完？',
  task: '购物车总价算错了，帮我修复，并补上测试。',
  phases: [
    { id: 'understand', label: '了解与计划' },
    { id: 'execute', label: '执行与验证' },
    { id: 'adjust', label: '调整修复' },
    { id: 'deliver', label: '完成交付' },
  ],
  mechanisms: [
    { id: 'plan', label: '计划', icon: '🧭', description: '明确修复步骤与完成条件。' },
    { id: 'memory', label: '记忆', icon: '🧠', description: '读取项目保存的约定，放入当前上下文。' },
    { id: 'tool', label: '工具', icon: '🔧', description: '由程序读取、修改文件并运行测试。' },
    { id: 'reflect', label: '反思', icon: '🔍', description: '依据失败证据检查并修正上一版。' },
  ],
  steps: [
    {
      id: 'task', mechanisms: [], title: '接到修复任务',
      phase: 0,
      assistant: '我会先查看项目约定和现有实现，再修复计算逻辑并补上测试。',
      action: '接收修复任务', command: '',
      summary: '先确认可检验的目标：2 件 19.90 元应合计 39.80 元，修复后还要通过测试。',
      file: '用户需求',
      code: 'cart_total([{ "price": "19.90", "quantity": 2 }])\n# 期望：Decimal("39.80")',
      status: 'running',
    },
    {
      id: 'plan', mechanisms: ['plan'], title: '列出修复计划',
      phase: 0,
      assistant: '先读取约定与源码，再复现错误、修改并验证。测试通过后，我会汇总修改和验证结果。',
      action: '更新执行计划', command: '',
      summary: '先安排定位、修复和验证三个阶段，再读取项目约定，补齐具体要求。',
      outputLabel: '执行计划',
      output: '1. 读取项目约定与源码\n2. 运行测试，复现错误\n3. 最小修改，补齐回归测试\n4. 根据测试结果决定继续修复或交付',
      status: 'running',
    },
    {
      id: 'read-memory', mechanisms: ['memory', 'tool'], title: '读取项目记忆',
      phase: 0,
      assistant: '项目要求使用 unittest，金额和返回值统一使用 Decimal，并保持函数接口。我会按这些约定修改。',
      action: '读取 AGENTS.md', command: 'read_file("AGENTS.md")', filePath: 'AGENTS.md',
      summary: 'read_file("AGENTS.md")：项目约定保存在文件中，读取后才进入这次任务的上下文。',
      file: 'AGENTS.md', code: CODE_FIXTURES.projectRules,
      memory: ['回归测试使用 unittest', '金额与函数返回值使用 Decimal', '保持原函数接口'],
      status: 'running',
    },
    {
      id: 'read-code', mechanisms: ['tool'], title: '查看出错代码',
      phase: 0,
      assistant: '当前代码直接累加价格，遗漏了商品数量，也没有处理字符串价格。我先补测试来复现问题。',
      action: '读取 cart.py', command: 'read_file("cart.py")', filePath: 'cart.py',
      summary: 'read_file("cart.py")：价格是字符串，原实现也没有计算商品数量。',
      file: 'cart.py · 原始版本', code: CODE_FIXTURES.initial,
      status: 'running',
    },
    {
      id: 'reproduce', mechanisms: ['tool'], title: '运行测试，复现错误',
      phase: 1,
      assistant: '我补了数量、空购物车和小数金额三项测试。原实现出现类型错误，空购物车的返回类型也不符合约定。',
      action: '新增测试并运行 unittest', command: 'python -B -m unittest -v', filePath: 'test_cart.py',
      summary: '补上三项测试，再调用 run_tests。实际错误结果会返回给模型。',
      file: 'test_cart.py', code: CODE_FIXTURES.tests,
      output: '$ python -B -m unittest -v\ntest_decimal_exact ... ERROR\ntest_empty_returns_decimal ... FAIL\ntest_quantity ... ERROR\nTypeError: unsupported operand type(s) for +: \'int\' and \'str\'\nFAILED (failures=1, errors=2)',
      status: 'failed',
    },
    {
      id: 'first-patch', mechanisms: ['tool', 'memory'], title: '写入第一版修复',
      phase: 1,
      assistant: '我已将价格转为 Decimal，并乘上商品数量。接下来运行回归测试，检查是否满足完成条件。',
      action: '修改 cart.py', command: 'edit_file("cart.py")', filePath: 'cart.py',
      diff: '--- a/cart.py\n+++ b/cart.py\n@@ -1,2 +1,7 @@\n+from decimal import Decimal\n+\n def cart_total(items):\n-    return sum(item["price"] for item in items)\n+    return sum(\n+        Decimal(str(item["price"])) * item["quantity"]\n+        for item in items\n+    )',
      summary: 'edit_file("cart.py")：按项目约定把价格转为 Decimal，并乘商品数量。',
      file: 'cart.py · 第一版修复', code: CODE_FIXTURES.firstPatch,
      status: 'running',
    },
    {
      id: 'regression-failure', mechanisms: ['tool'], title: '回归仍有一项失败',
      phase: 1,
      assistant: '数量和小数金额测试已通过，但空购物车测试仍然失败：返回的是整数 0。还需要继续修复。',
      action: '运行回归测试', command: 'python -B -m unittest -v',
      summary: '普通购物车已修好，但空购物车返回整数 0，没有遵守 Decimal 返回类型约定。',
      output: '$ python -B -m unittest -v\ntest_decimal_exact ... ok\ntest_empty_returns_decimal ... FAIL\ntest_quantity ... ok\nAssertionError: 0 is not an instance of <class \'decimal.Decimal\'>\nFAILED (failures=1)',
      status: 'failed',
    },
    {
      id: 'reflect', mechanisms: ['reflect', 'memory'], title: '根据证据修正判断',
      phase: 2,
      assistant: '空序列的 sum 默认返回整数 0。我会显式设置 Decimal 初始值，再重新验证三项测试。',
      action: '核对失败结果与项目约定', command: '',
      summary: '核对失败用例和项目约定：空序列的 sum 默认从整数 0 开始，需要显式提供 Decimal 初始值。',
      code: 'sum([])                       # 0，类型为 int\nsum([], Decimal("0.00"))       # Decimal("0.00")',
      outputLabel: '下一步决定',
      memory: ['仍需满足：cart_total 始终返回 Decimal'],
      output: '下一步：只调整求和初始值，然后重跑全部三项测试。',
      status: 'running',
    },
    {
      id: 'final-patch', mechanisms: ['tool', 'reflect'], title: '写入第二版修复',
      phase: 2,
      assistant: '已补上 Decimal("0.00") 初始值，空购物车也会返回金额类型。现在重新运行测试。',
      action: '再次修改 cart.py', command: 'edit_file("cart.py")', filePath: 'cart.py',
      diff: '--- a/cart.py\n+++ b/cart.py\n@@ -2,6 +2,7 @@\n \n def cart_total(items):\n     return sum(\n-        Decimal(str(item["price"])) * item["quantity"]\n-        for item in items\n+        (Decimal(str(item["price"])) * item["quantity"]\n+         for item in items),\n+        Decimal("0.00"),\n     )',
      summary: 'edit_file("cart.py")：增加 Decimal("0.00") 作为起始值，函数接口保持不变。',
      file: 'cart.py · 最终版本', code: CODE_FIXTURES.final,
      status: 'running',
    },
    {
      id: 'verified', mechanisms: ['tool'], title: '三项测试全部通过',
      phase: 2,
      assistant: '三项测试全部通过，数量计算、小数金额和空购物车都满足本次要求。可以交付了。',
      action: '重新运行回归测试', command: 'python -B -m unittest -v',
      summary: 'run_tests 返回真实可核验的成功证据，覆盖本次约定的三种情况。',
      output: '$ python -B -m unittest -v\ntest_decimal_exact ... ok\ntest_empty_returns_decimal ... ok\ntest_quantity ... ok\nRan 3 tests\nOK',
      status: 'passed',
    },
    {
      id: 'delivery', mechanisms: ['plan', 'memory'], title: '核对完成条件并交付',
      phase: 3,
      assistant: '已修复 cart.py，并新增 test_cart.py。三项回归测试通过，函数接口保持不变；本次验证覆盖了约定的三种情况。',
      action: '交付修改与验证结果', command: '',
      summary: '已修复类型转换、数量计算和空购物车返回类型，新增三项回归测试。项目约定保存在文件中，本轮测试结果属于当前任务记录。',
      outputLabel: '交付记录',
      output: '已修改：cart.py\n已新增：test_cart.py\n验证：3 项测试通过\n范围：仅覆盖本例约定的输入，不代表所有异常输入都已验证。',
      status: 'done',
    },
  ],
  sources: [
    { title: 'Lilian Weng · LLM Powered Autonomous Agents（2023）', url: 'https://lilianweng.github.io/posts/2023-06-23-agent/' },
    { title: 'Anthropic · Building effective agents（2024）', url: 'https://www.anthropic.com/research/building-effective-agents' },
  ],
};
