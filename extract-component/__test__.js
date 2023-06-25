// → 导入 transformSync
const { transformSync } = require('@babel/core');
const jsx = require('@babel/preset-react')

// → 编写测试代码
const code = `const a = 10
function Button() {
  return <div>
    <button label="hello" id={a}>{a}</button>
  	<p>hello world</p>
    </div>
}`;

// → 调用插件处理code
const output = transformSync(code, {
  plugins: ['./index.js', 'jsx'],
});

// → 输出目标代码
console.log(output.code);


