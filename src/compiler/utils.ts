export const id = () => {
    let result = '';
    for (let index = 0; index < 4; index++) {
        if (getRand() > 0.5) {
            result += String.fromCharCode(65 + getRand() * 25);
        } else {
            result += String.fromCharCode(97 + getRand() * 25);
        }
    }
    return result;
}

const a = (Math.random()*2**32)>>>0;
const b = (Math.random()*2**32)>>>0;
const c = (Math.random()*2**32)>>>0;
const d = (Math.random()*2**32)>>>0;
export const resetId = () => {
    getRand = sfc32(a, b, c, d);
}

let getRand = () => 0;
resetId();

function sfc32(a: number, b: number, c: number, d: number) {
  return function() {
    a |= 0; b |= 0; c |= 0; d |= 0;
    let t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  }
}