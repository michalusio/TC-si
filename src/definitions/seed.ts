import { addDef, addType } from "../typeSetup";
import { intType } from "./int";

const seedType = addType(
  "Seed",
  "A type used for seeding the random generator"
);
addDef("get_random_seed", "pub def get_random_seed() Seed {", seedType, []);
addDef("next", "pub dot next($s: Seed) Int {", intType, [seedType]);
addDef("random", "pub def random(max: Int) Int {", intType, [intType]);
