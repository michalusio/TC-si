import { addDot, addType, arr } from "../typeSetup";

const fileType = addType(
    "File",
    "Type used for operating on files"
);

addDot('write', 'pub dot write(file: File, data: [U8]) {', null, [fileType, arr('U8')])
addDot('write', 'pub dot write(file: File, text: String) {', null, [fileType, 'String'])