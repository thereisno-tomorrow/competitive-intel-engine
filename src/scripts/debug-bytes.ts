// Inspect the raw protobuf bytes of a Google News article ID
const articleId = "CBMi0AFBVV95cUxNWXVyOGVIY1hzRjNxVkRmZWMwTXpoTl9SNzlSOVpBMHBwcmFSUW90N2ZHV2M5TENxM2RJTWVYaVd1Wk1ZTWdWT0RrWmVTbW1yTDZNNGpUcFlGNVd1SWZ0MEZSdUVySGh1QnlrR3paaVRJQi1hYUMtSmFPMG1PV2xFTndleUVTZUp1Qnp4SE9vNVEycnlvMG9GWHIyTDNZUEVzLV9QUWpaejRIbEJYd3cwN3ZsWlRWN3RvbnYtUENGZ1Zqd0lnZlNmMFpPa3pGYVN0";

const buf = Buffer.from(articleId, "base64");

console.log("Total bytes:", buf.length);
console.log("\nFirst 20 bytes (hex):", [...buf.slice(0, 20)].map(b => b.toString(16).padStart(2, "0")).join(" "));
console.log("First 20 bytes (decimal):", [...buf.slice(0, 20)].join(", "));

// Parse protobuf manually
let offset = 0;

// Field 1: tag 0x08 = field 1 varint
if (buf[0] === 0x08) {
  offset = 1;
  let val = 0, shift = 0;
  while (offset < buf.length && buf[offset]! >= 0x80) {
    val |= (buf[offset]! & 0x7f) << shift;
    shift += 7;
    offset++;
  }
  val |= (buf[offset]! & 0x7f) << shift;
  offset++;
  console.log(`\nField 1 (varint): ${val}`);
}

// Field 4: tag 0x22 = field 4 length-delimited
if (buf[offset] === 0x22) {
  offset++;
  let len = 0, shift = 0;
  while (offset < buf.length) {
    const byte = buf[offset]!;
    len |= (byte & 0x7f) << shift;
    offset++;
    if (byte < 0x80) break;
    shift += 7;
  }
  const content = buf.subarray(offset, offset + len).toString("utf-8");
  console.log(`Field 4 (length ${len}): "${content.slice(0, 200)}"`);
  console.log(`Starts with http: ${content.startsWith("http")}`);
  console.log(`Starts with AU_yqL: ${content.startsWith("AU_yqL")}`);
  console.log(`First 30 chars: "${content.slice(0, 30)}"`);
} else {
  console.log(`\nByte at offset ${offset}: 0x${buf[offset]!.toString(16)} (expected 0x22 for field 4)`);
  // Dump remaining structure
  console.log("Remaining bytes as utf-8:", buf.subarray(offset).toString("utf-8").slice(0, 200));
}
