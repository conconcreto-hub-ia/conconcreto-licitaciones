// Revisa el buzón del agente una vez. Es lo que llama la rutina.
import "./_env";
import { revisarBuzon } from "../src/lib/buzon";
import { db } from "../src/lib/db";
revisarBuzon().then((r) => console.log(r)).finally(() => db.$disconnect());
