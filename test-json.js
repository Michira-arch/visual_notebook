const badJson = '{\n  "key": "line 1\nline 2"\n}';
const regex = /"([^"\\]*(\\.[^"\\]*)*)"/g;
const fixed = badJson.replace(regex, (match) => {
  return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
});

console.log(fixed);
console.log(JSON.parse(fixed).key);
