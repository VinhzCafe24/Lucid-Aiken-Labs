import { Blockfrost, Lucid, Addresses, fromHex, toHex, Data, paymentCredentialOf, Constr, fromText, applyParamsToScript } from "https://deno.land/x/lucid@0.20.9/mod.ts";
import "jsr:@std/dotenv/load";
import * as cbor from "https://deno.land/x/cbor@v1.4.1/index.js";

// Lấy các biến từ env
const Bob_mnonic = Deno.env.get("MNEMONIC");
const BLOCKFROST_ID = Deno.env.get("BLOCKFROST_ID");
const BLOCKFROST_NETWORK = Deno.env.get("BLOCKFROST_NETWORK")

const lucid = new Lucid({
    provider: new Blockfrost(
      BLOCKFROST_NETWORK,
      BLOCKFROST_ID,
    ),
  });
lucid.selectWalletFromSeed(Bob_mnonic);

const addr_me01 = await lucid.wallet.address();
console.log(`>>> Địa chỉ ví đang dùng: ${addr_me01}`);

//Các biến cần dùng
const addr_BTC = "addr_test1qz3vhmpcm2t25uyaz0g3tk7hjpswg9ud9am4555yghpm3r770t25gsqu47266lz7lsnl785kcnqqmjxyz96cddrtrhnsdzl228";
const dddr_me02 = "addr_test1qzhmts2nhr3fpag0wl0ns4puqlseg5ey4hfa3n8w95x9ym0mgx64n2gpvmhy8ru6m08307wwv7q25hmtxafd5end5eusk8c8vd";
const prefixx = fromText("BK02");

const validator = await readValidator();
const Params = [Data.Bytes()];

// Đọc script lần đầu 
// 1- Applied parameter cho hợp đồng thông mình bằng mã khóa học: BK02.
const parameterized_script = lucid.newScript({
    type: "PlutusV3",
    script: validator.script,
  },[prefixx], /// nhét tham số này vào parameterized
 Params
);

const scriptAddress = parameterized_script.toAddress();
console.log(`>>>Parameterized script là: ${scriptAddress}`);

const policyId = parameterized_script.toHash();

//2- Mint token bắt buộc bắt đầu bằng: BK02 sau đó là tên học viên, ví dụ BK02_NGUYEN_VAN_HIEU
const tokenname = fromText("BK02_Pham Huynh Quang Vinh");
const unit = policyId + tokenname;
const mintingredeemer = Data.to(new Constr(0, []));

const payment_credential = Addresses.inspect(
      addr_BTC
).payment?.hash;

// 4- NTF mint được phải chuyển về địa chỉ BTC: addr_test1qz3vhmpcm2t25uyaz0g3tk7hjpswg9ud9am4555yghpm3r770t25gsqu47266lz7lsnl785kcnqqmjxyz96cddrtrhnsdzl228
console.log(`>>> pay-cred: ${payment_credential}`);

const tx = await lucid
      .newTx()
//3- Giao dịch phải có 04 outputs
      .mint ({ [unit]: 1n }, mintingredeemer)
//4- NTF mint được phải chuyển về địa chỉ BTC: addr_test1qz3vhmpcm2t25uyaz0g3tk7hjpswg9ud9am4555yghpm3r770t25gsqu47266lz7lsnl785kcnqqmjxyz96cddrtrhnsdzl228
      .payTo(addr_BTC,  { [unit]: 1n, lovelace: 19000000n })
      .payTo(dddr_me02, { lovelace: 19000000n })
      .payTo(dddr_me02, { lovelace: 19000000n })
      .attachScript(parameterized_script)
      .commit();
const signedTx = await tx.sign().commit();
const txID = await signedTx.submit();
console.log(`>>> Tx đã được gửi: ${tx}`);
console.log(`>>> TxID: https://preview.cexplorer.io/tx/${txID} `);

async function readValidator(): Promise<SpendingValidator> {
  const validator = JSON.parse(await Deno.readTextFile("plutus.json")).validators[0];
  return {
    type: "PlutusV3",
    script: toHex(cbor.encode(fromHex(validator.compiledCode))),
  };
}
