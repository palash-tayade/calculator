const http = require('http');
const url = require('url');

const PORT = 8080;

// Safe arithmetic evaluator — no eval()
function calculate(expr) {
  expr = expr.replace(/\s+/g, '');
  if (!expr) return 'Error';

  let pos = 0;

  function peek() { return expr[pos]; }
  function consume() { return expr[pos++]; }

  function parseExpr() { return parseAddSub(); }

  function parseAddSub() {
    let left = parseMulDiv();
    while (pos < expr.length && (peek() === '+' || peek() === '-')) {
      const op = consume();
      const right = parseMulDiv();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseMulDiv() {
    let left = parseUnary();
    while (pos < expr.length && (peek() === '*' || peek() === '/')) {
      const op = consume();
      const right = parseUnary();
      if (op === '/') {
        if (right === 0) throw new Error('Division by zero');
        left = left / right;
      } else {
        left = left * right;
      }
    }
    return left;
  }

  function parseUnary() {
    if (peek() === '-') { consume(); return -parsePrimary(); }
    if (peek() === '+') { consume(); }
    return parsePrimary();
  }

  function parsePrimary() {
    if (peek() === '(') {
      consume(); // '('
      const val = parseExpr();
      if (consume() !== ')') throw new Error('Missing )');
      return val;
    }
    // Parse number
    const start = pos;
    if (peek() === '-') pos++;
    while (pos < expr.length && /[\d.]/.test(expr[pos])) pos++;
    if (pos === start) throw new Error('Expected number at ' + pos);
    return parseFloat(expr.slice(start, pos));
  }

  try {
    const result = parseExpr();
    if (pos < expr.length) throw new Error('Unexpected character');
    if (!isFinite(result)) return 'Error: Division by zero';
    // Return integer if whole number
    if (result === Math.floor(result)) return String(Math.trunc(result));
    return String(Math.round(result * 1e10) / 1e10);
  } catch (e) {
    return 'Error: ' + e.message;
  }
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Calculator</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1a1a2e;
      font-family: 'Segoe UI', Arial, sans-serif;
    }
    .calculator {
      background: #16213e;
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      width: 320px;
    }
    .display {
      background: #0f3460;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 20px;
      text-align: right;
    }
    .display .expression {
      color: #a0aec0;
      font-size: 14px;
      min-height: 20px;
      word-break: break-all;
      margin-bottom: 6px;
    }
    .display .result {
      color: #e2e8f0;
      font-size: 36px;
      font-weight: 300;
      word-break: break-all;
      min-height: 44px;
    }
    .buttons {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    button {
      background: #1a1a4e;
      color: #e2e8f0;
      border: none;
      border-radius: 12px;
      padding: 18px 10px;
      font-size: 18px;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
      user-select: none;
    }
    button:hover  { background: #2a2a6e; }
    button:active { transform: scale(0.95); }
    button.op { background: #0f3460; color: #63b3ed; font-size: 20px; }
    button.op:hover { background: #1a4a80; }
    button.equals { background: #e94560; color: white; font-size: 22px; }
    button.equals:hover { background: #c73652; }
    button.clear { background: #2d3748; color: #fc8181; }
    button.clear:hover { background: #3d4a5a; }
    button.wide { grid-column: span 2; }
    .error { color: #fc8181 !important; font-size: 20px !important; }

    .history {
      margin-top: 20px;
      background: #0f3460;
      border-radius: 12px;
      overflow: hidden;
    }
    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      color: #a0aec0;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .history-header button {
      background: none;
      color: #a0aec0;
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 6px;
      border: 1px solid #2d3748;
    }
    .history-header button:hover { background: #1a4a80; color: #e2e8f0; }
    .history-list {
      max-height: 180px;
      overflow-y: auto;
    }
    .history-list::-webkit-scrollbar { width: 4px; }
    .history-list::-webkit-scrollbar-track { background: transparent; }
    .history-list::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 2px; }
    .history-item {
      padding: 8px 16px;
      cursor: pointer;
      border-top: 1px solid #1a2a4a;
      transition: background 0.1s;
      text-align: right;
    }
    .history-item:hover { background: #1a4a80; }
    .history-item .hist-expr { color: #a0aec0; font-size: 12px; }
    .history-item .hist-result { color: #e2e8f0; font-size: 18px; }
    .history-empty { padding: 16px; text-align: center; color: #4a5568; font-size: 13px; }
  </style>
</head>
<body>
<div class="calculator">
  <div class="display">
    <div class="expression" id="expression"></div>
    <div class="result" id="result">0</div>
  </div>
  <div class="buttons">
    <button class="clear" onclick="clearAll()">AC</button>
    <button class="clear" onclick="deleteLast()">&#9003;</button>
    <button class="op"    onclick="append('()')">(  )</button>
    <button class="op"    onclick="append('/')">&#247;</button>

    <button onclick="append('7')">7</button>
    <button onclick="append('8')">8</button>
    <button onclick="append('9')">9</button>
    <button class="op" onclick="append('*')">&#215;</button>

    <button onclick="append('4')">4</button>
    <button onclick="append('5')">5</button>
    <button onclick="append('6')">6</button>
    <button class="op" onclick="append('-')">&#8722;</button>

    <button onclick="append('1')">1</button>
    <button onclick="append('2')">2</button>
    <button onclick="append('3')">3</button>
    <button class="op" onclick="append('+')">+</button>

    <button class="wide" onclick="append('0')">0</button>
    <button onclick="append('.')">.</button>
    <button class="equals" onclick="calculate()">=</button>
  </div>
  <div class="history">
    <div class="history-header">
      <span>History</span>
      <button onclick="clearHistory()">Clear</button>
    </div>
    <div class="history-list" id="historyList">
      <div class="history-empty" id="historyEmpty">No calculations yet</div>
    </div>
  </div>
</div>
<script>
  let expression = '';
  let justCalculated = false;
  let history = JSON.parse(localStorage.getItem('calcHistory') || '[]');

  function saveHistory() {
    localStorage.setItem('calcHistory', JSON.stringify(history));
  }

  function renderHistory() {
    const list = document.getElementById('historyList');
    const empty = document.getElementById('historyEmpty');
    // Remove old items (keep the empty placeholder)
    [...list.querySelectorAll('.history-item')].forEach(el => el.remove());
    if (history.length === 0) {
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';
    // Newest first
    [...history].reverse().forEach(item => {
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = \`<div class="hist-expr">\${item.expr} =</div><div class="hist-result">\${item.result}</div>\`;
      div.onclick = () => {
        expression = item.result;
        justCalculated = true;
        updateDisplay();
        document.getElementById('result').textContent = item.result;
        document.getElementById('result').className = 'result';
      };
      list.appendChild(div);
    });
  }

  function clearHistory() {
    history = [];
    saveHistory();
    renderHistory();
  }

  renderHistory();

  function updateDisplay() {
    document.getElementById('expression').textContent = expression;
  }

  function append(value) {
    if (justCalculated) {
      const ops = ['+', '-', '*', '/'];
      if (!ops.includes(value)) expression = '';
      justCalculated = false;
    }
    if (value === '()') {
      const opens  = (expression.match(/\\(/g) || []).length;
      const closes = (expression.match(/\\)/g) || []).length;
      value = opens > closes ? ')' : '(';
    }
    expression += value;
    updateDisplay();
    document.getElementById('result').className = 'result';
  }

  function clearAll() {
    expression = '';
    justCalculated = false;
    document.getElementById('result').textContent = '0';
    document.getElementById('result').className = 'result';
    updateDisplay();
  }

  function deleteLast() {
    if (justCalculated) { clearAll(); return; }
    expression = expression.slice(0, -1);
    updateDisplay();
  }

  async function calculate() {
    if (!expression) return;
    const expr = expression;
    document.getElementById('expression').textContent = expr + ' =';
    try {
      const res = await fetch('/calculate?expr=' + encodeURIComponent(expr));
      const text = await res.text();
      const el = document.getElementById('result');
      el.textContent = text;
      if (text.startsWith('Error')) {
        el.className = 'result error';
        justCalculated = false;
      } else {
        el.className = 'result';
        history.push({ expr, result: text });
        saveHistory();
        renderHistory();
        expression = text;
        justCalculated = true;
      }
    } catch (e) {
      document.getElementById('result').textContent = 'Error';
      document.getElementById('result').className = 'result error';
    }
  }

  document.addEventListener('keydown', e => {
    if (e.key >= '0' && e.key <= '9') append(e.key);
    else if (['+','-','*'].includes(e.key)) append(e.key);
    else if (e.key === '/') { e.preventDefault(); append('/'); }
    else if (e.key === '.') append('.');
    else if (e.key === '(' || e.key === ')') append(e.key);
    else if (e.key === 'Enter' || e.key === '=') calculate();
    else if (e.key === 'Backspace') deleteLast();
    else if (e.key === 'Escape') clearAll();
  });
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

  if (parsed.pathname === '/calculate') {
    const expr = parsed.query.expr || '';
    const result = calculate(expr);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(result);
    return;
  }

  // Serve calculator page for all other routes
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(HTML);
});

server.listen(PORT, () => {
  console.log(`Calculator running at http://localhost:${PORT}`);
});
