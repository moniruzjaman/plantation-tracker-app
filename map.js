import fs from 'fs';

const p1 = fs.readFileSync('public/part1.txt', 'utf8');
const p2 = fs.readFileSync('public/part2.txt', 'utf8');
const p3 = fs.readFileSync('public/part3.txt', 'utf8');
const p4 = fs.readFileSync('public/part4.txt', 'utf8');
const p5 = fs.readFileSync('public/part5.txt', 'utf8');
const p6 = fs.readFileSync('public/part6.txt', 'utf8');
const p7 = fs.readFileSync('public/part7.txt', 'utf8');

fs.writeFileSync('public/legacy-nursery.html', p1 + p2 + p3 + p4 + p5 + p6 + p7);
console.log('Done mapping.');
