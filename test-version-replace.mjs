const input = "#version 450";
const regex = /#version\s+[\d.]+\s*(?:es)?/;
const result = input.replace(regex, '#version 300 es');
console.log('Input:', input);
console.log('Output:', result);
console.log('Matched:', regex.test(input));
