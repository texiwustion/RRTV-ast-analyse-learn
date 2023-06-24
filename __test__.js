// → 导入 transformSync
const { transformSync } = require('@babel/core');

// → 编写测试代码
const code = `a === b`;

// → 调用插件处理code
const output = transformSync(code, {
  plugins: ['./plug1.js'],
});

// → 输出目标代码
console.log(output.code);
