// → 导入模块
const parser = require('@babel/parser');

// → 定义一段代码字符串
const code = `
        function getName() {
            return <div>
                your name
            </div>
        } 
        function getAge() {
            const age = 14
            return <div>
                my age is {age}
            </div>
        }
    `;
// → 解析代码字符串
const ast = parser.parse(code, {
    sourceType: 'script', // module unambigious
    plugins: ['jsx', 'typescript'],
});

// → 输出ast
console.log(JSON.stringify(ast, null, 4));