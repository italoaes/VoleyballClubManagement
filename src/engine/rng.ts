/**
 * Gerador de números aleatórios determinístico com seed (porte de rng.py).
 *
 * Contrato P2: a paridade com o Python é ESTATÍSTICA, não de sequência bit-a-bit.
 * Não replicamos o PCG64/SeedSequence do numpy — usamos um PRNG próprio de boa
 * qualidade (sfc32) com hashing de seed e `spawn(key)` para sub-streams
 * reprodutíveis e independentes, mesmo em múltiplos níveis de derivação.
 */

/** Mistura de bits para derivar estado a partir de uma string/seed (splitmix-like). */
function hashSeed(...parts: number[]): [number, number, number, number] {
  // Combina as partes num acumulador de 32 bits via variação de xmur3.
  let h = 1779033703 ^ parts.length;
  for (const part of parts) {
    let x = part | 0;
    h = Math.imul(h ^ x, 3432918353);
    h = (h << 13) | (h >>> 19);
    // segunda passada para dispersar bits altos de `part`
    x = (x >>> 16) | (x << 16);
    h = Math.imul(h ^ x, 461845907);
    h = (h << 13) | (h >>> 19);
  }
  // Gera 4 sementes de 32 bits para o estado do sfc32.
  const next = (): number => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
  return [next(), next(), next(), next()];
}

/** sfc32: PRNG rápido de 32 bits com bom perfil estatístico. */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  let sa = a >>> 0;
  let sb = b >>> 0;
  let sc = c >>> 0;
  let sd = d >>> 0;
  return function next(): number {
    sa >>>= 0;
    sb >>>= 0;
    sc >>>= 0;
    sd >>>= 0;
    let t = (sa + sb) | 0;
    sa = sb ^ (sb >>> 9);
    sb = (sc + (sc << 3)) | 0;
    sc = (sc << 21) | (sc >>> 11);
    sd = (sd + 1) | 0;
    t = (t + sd) | 0;
    sc = (sc + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export class Rng {
  private readonly _seed: number;
  private readonly _spawnKey: readonly number[];
  private readonly _next: () => number;

  constructor(seed: number, spawnKey: readonly number[] = []) {
    this._seed = Math.trunc(seed);
    this._spawnKey = spawnKey;
    const [a, b, c, d] = hashSeed(this._seed, ...spawnKey);
    this._next = sfc32(a, b, c, d);
  }

  get seed(): number {
    return this._seed;
  }

  /** Float uniforme em [0, 1). */
  random(): number {
    return this._next();
  }

  /** Float uniforme em [low, high). */
  uniform(low: number, high: number): number {
    return low + (high - low) * this._next();
  }

  /** Inteiro em [low, high) (high exclusivo). */
  integers(low: number, high: number): number {
    return low + Math.floor(this._next() * (high - low));
  }

  /**
   * Deriva um RNG-filho determinístico a partir de uma chave inteira.
   * Sub-streams não colidem mesmo em múltiplos níveis (spawn de spawn),
   * pois a chave é acumulada no caminho de derivação.
   */
  spawn(key: number): Rng {
    return new Rng(this._seed, [...this._spawnKey, Math.trunc(key)]);
  }
}
