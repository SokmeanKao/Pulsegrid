const BUFFER_SIZE = 60;

function pushBounded(buf, item, max = BUFFER_SIZE) {
  const next = [...buf, item];
  if (next.length > max) next.splice(0, next.length - max);
  return next;
}

let buf = [];
for (let i = 0; i < BUFFER_SIZE + 5; i++) {
  buf = pushBounded(buf, i);
}
if (buf.length !== BUFFER_SIZE || buf[0] !== 5) {
  console.error("FAIL", buf.length, buf[0]);
  process.exit(1);
}
console.log("ok");
