import { addEnum } from "../typeSetup";
import { boolType } from "./bool";

addEnum(
  "TestResult",
  "Describes whether the test passes, fails, or wins the level",
  ["pass", "fail", "win"],
  boolType
);