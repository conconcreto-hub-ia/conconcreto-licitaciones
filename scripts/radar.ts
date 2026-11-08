// Corre el radar una vez. Es lo que llama la rutina diaria.
import "./_env";
import { correrRadar } from "../src/lib/radar";
import { db } from "../src/lib/db";
correrRadar().then((r) => console.log(r)).finally(() => db.$disconnect());
