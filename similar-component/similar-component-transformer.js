var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var j = require("jscodeshift");
var isSameSet = function (s1, s2) {
    /* 获取一个集合所有的值，判断另外一个集合是否全部包含该这些值 */
    var isSame = function (a, b) {
        var values = __spreadArray([], a, true);
        for (var _i = 0, values_1 = values; _i < values_1.length; _i++) {
            var val = values_1[_i];
            if (!b.has(val))
                return false;
        }
        return true;
    };
    /* a 包含 b，b 包含 a，那么两个集合相同 */
    return isSame(s1, s2) && isSame(s2, s1);
};
function checkJSXElement(jsxElements, j, root) {
    var total = [];
    var childCountSet = new Set();
    var count = 0;
    var childcount = 0;
    var check = true;
    /// 2 如果 div 少于两个，那没必要判断是否相似
    if (jsxElements.length < 2) {
        console.log("exit at hasSameElements", jsxElements.get(0).node.openingElement.name.name);
        //return root.toSource()
        return false;
    }
    jsxElements.forEach(function (path) {
        total.push(new Set());
        var set = total[count];
        var jsxChildren = j(path).childElements();
        /// 4 如果没有儿子，也一定不相似
        if (!jsxChildren.length) {
            console.log("exit at hasChildren", jsxElements.get(0).node.openingElement.name.name);
            return false;
            //return root.toSource()
        }
        childCountSet.add(jsxChildren.length);
        /// 3 如果子节点有不同数量，那不相似
        if (childCountSet.size > 1) {
            console.log("exit at childCountSet");
            return false;
            //return root.toSource()
        }
        jsxChildren.forEach(function (path) {
            set.add(path.node.openingElement.name.name);
            var jsxAttributes = j(path.node.openingElement.attributes);
            jsxAttributes.forEach(function (path) {
                var name = path.node.name.name;
                set.add(name);
            });
            childcount++;
        });
        count++;
    });
    for (var i = 0; i < total.length - 2; ++i) {
        if (isSameSet(total[i], total[i + 1]))
            check = false;
    }
    console.log(check, "check", jsxElements.get(0).node.openingElement.name.name); //true
    return check;
}
function constructJSXElement(attrName, attrValue) {
    var rest = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        rest[_i - 2] = arguments[_i];
    }
    var j = rest[0];
    var attributes = [];
    for (var i = 0; i < attrName.length; i++) {
        var propertyName = j.jsxIdentifier(attrName[i]);
        var propertyValue = j.literal(attrValue[i]);
        var attribute = j.jsxAttribute(propertyName, propertyValue); //j.jsxExpressionContainer(propertyValue)
        attributes.push(attribute);
    }
    var openingElement = j.jsxOpeningElement(j.jsxIdentifier("NewFunction"), attributes, true);
    var jsxElement = j.jsxElement(openingElement, null, []);
    return jsxElement;
}
function check(j, root) {
    var classify = {};
    var allname = new Set();
    var lenOfName = 0;
    var all = root.findJSXElements();
    all.forEach(function (path) {
        var nodeName = path.node.openingElement.name.name;
        allname.add(nodeName);
        if (lenOfName !== allname.size) {
            if (classify[nodeName]) {
                classify[nodeName].push(path);
            }
            else {
                classify[nodeName] = [];
                classify[nodeName].push(path);
            }
            lenOfName = allname.size;
        }
        else {
            classify[nodeName].push(path);
        }
    });
    /// 添加诊断
    var res = {};
    for (var key in classify) {
        var checkResult = checkJSXElement(j(classify[key]), j, root);
        if (checkResult) {
            res["diag"] = true;
            res[key] = classify[key];
        }
    }
    return res;
}
var modifier = function (j, divElements) {
    //const divElements = root.findJSXElements("div");
    /// after filter by index   // const elementIndex = filterIndex()
    var elementIndex = 0;
    var divElementPath = divElements.paths()[elementIndex];
    /// set attributes
    var children = j(divElementPath).childElements();
    /// 准备记录 name & value
    var attrname = [];
    var attrvalue = [];
    children.forEach(function (path) {
        var jsxAttributes = j(path.node.openingElement.attributes);
        jsxAttributes.forEach(function (path) {
            /// 记录 name & value
            var name = path.node.name.name;
            var value = path.node.value.value;
            attrname.push(name);
            attrvalue.push(value);
            /// 改变 value
            path.node.value = j.jsxExpressionContainer(j.identifier(name));
        });
    });
    var findFunctionDeclaration = j(divElementPath).closest(j.FunctionDeclaration);
    var declaration = findFunctionDeclaration.length
        ? findFunctionDeclaration
        : j(divElementPath).closest(j.VariableDeclaration);
    console.log(declaration);
    /// 新函数, 用 <></>包裹 jsxElement
    var jsxFragment = j.jsxFragment(j.jsxOpeningFragment(), j.jsxClosingFragment(), [divElementPath.node]);
    /// 函数参数生成
    var newParams = [];
    attrname.forEach(function (name) {
        newParams.push(j.property("init", j.identifier(name), j.identifier(name)));
    });
    var newFunctionDeclaration = j.functionDeclaration(j.identifier("newFunction"), [j.objectPattern(newParams)], j.blockStatement([j.returnStatement(jsxFragment)]));
    declaration.at(0).insertBefore(newFunctionDeclaration);
    /// 替换原来位置
    var alternativeElement = constructJSXElement(attrname, attrvalue, j);
    console.log(divElements.at(elementIndex));
    divElements.at(elementIndex).replaceWith(alternativeElement);
    /// 更改其他相似组件
    var restDivElements = divElements.filter(function (path) { return path !== divElementPath; });
    restDivElements.forEach(function (path) {
        /// set attributes
        var children = j(path).childElements();
        /// 准备记录 name & value
        var attrName = [];
        var attrValue = [];
        children.forEach(function (path) {
            var jsxAttributes = j(path.node.openingElement.attributes);
            jsxAttributes.forEach(function (path) {
                /// 记录 name & value
                var name = path.node.name.name;
                var value = path.node.value.value;
                attrName.push(name);
                attrValue.push(value);
            });
        });
        /// 替换原来位置
        var restAlternativeElement = constructJSXElement(attrname, attrvalue, j);
        j(path).replaceWith(restAlternativeElement);
    });
};
/* function interactor(j, root) {
    const res = check(j, root)
    let diag = false
    if (res === {})
        return { diag }
    else
        return { diag, res }
    return res
} */
function transformer(file, api) {
    var j = api.jscodeshift;
    var root = j(file.source);
    var res = check(j, root);
    var diag = res["diag"];
    if (!diag) {
        console.log("条件不满足");
        return false;
    }
    var name = 'hello';
    var elements = j(res[name]);
    console.log(elements);
    modifier(j, elements);
    return root.toSource();
}
var text = "const TestSim = () => {\n  return <>\n\n\t<div>\n\t\t<button id=\"1\" me=\"2\"></button>\n\t\t<button you=\"3\" type=\"4\"></button>\n\t</div>\n\t<p></p>\n</> \n}\nconst TestSim2 = () => {\n  return <>\n\t<code></code>\n\n\t<hello>\n\t\t<button id=\"1\" me=\"2\"></button>\n\t\t<button you=\"3\" type=\"4\"></button>\n\t</hello>\n</> \n}";
var api = {
    jscodeshift: j
};
var interactor = function (text) {
    var file = { source: text };
    var res = transformer(file, api);
    console.log(res);
};
interactor(text);
