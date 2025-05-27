import { Blockfrost, Data, Lucid, Addresses, Constr, fromText, toHex } from  "https://deno.land/x/lucid/mod.ts";

const lucid = new Lucid({
    provider: new Blockfrost(
        "https://cardano-preview.blockfrost.io/api/v0", 
        "previewBtMPdoFkgg7hVE8n0tcnBwShsMi2FKsi",
    ),
});

const seed = "oxygen column size home version aisle eternal usual used assist airport defense visa ten syrup curious naive gospel boring energy lyrics hand load army";
lucid.selectWalletFromSeed(seed, { addressType: "Base", index: 0});

// Get address
const address = await lucid.wallet.address(); 
console.log (`>>> My-Wallet: ${address}`)
const { payment: paymentOwner  } = Addresses.inspect(address);
console.log(`paymentOwner.hash: ${paymentOwner.hash}`); 

const vesting_scripts = lucid.newScript({
  type: "PlutusV3",
  script:"59022401010029800aba2aba1aba0aab9faab9eaab9dab9a488888896600264653001300800198041804800cdc3a400530080024888966002600460106ea800e2646644b30013370e900018059baa0018cc004c03cc030dd5000c8c040c044c044c044c044c044c044c04400646020602260226022602260226022602260220032232330010010032259800800c528456600266e3cdd71809800801c528c4cc008008c05000500e2022488896600264b3001330023758600660226ea8024dd7180098089baa005899191919912cc004c03cc054dd50014566002601e602a6ea8c064c06800e266e20dd6980c980b1baa002001899b89375a6032602c6ea8008005014452820283017001375a602e60286ea8020cc054c058004cc0566002601860246ea8c058c05c00698103d87a8000a60103d8798000404497ae030123754600460246ea8004c010c044dd5004c528201e2301430150018a518acc004cc004dd6180118081baa008375c60266028602860206ea801226464646644b3001300e301437540051598009807180a1baa30183019003899b88001375a6030602a6ea800a266e24004dd6980c180a9baa002404d14a08098c058004dd6980b18099baa007330143015001330149800980598089baa30153016001a6103d87a8000a60103d8798000404097ae030113754602860226ea8004c00cc040dd50044528201c40388b2014300d001300d300e0013009375400716401c300800130033754011149a26cac8009",         
});

const signerbyAddress = vesting_scripts.toAddress();
console.log(`>> vesting addr: ${signerbyAddress}`);

const Vestingdatum = Data.Object({
  lock_until: Data.Integer(),
  owner: Data.Bytes,
  beneficiary: Data.Bytes(),
});

type Vestingdatum = typeof Vestingdatum;

//---------------------------------------------------

const deadlineDate = Date.now(); 
const offset = 25 * 60 * 1000; // 5 phút
const deadlinePosIx =BigInt((deadlineDate+offset))
console.log(">>> DeadlinePosIx: ", deadlinePosIx);

const { payment: paymentBeneficiary } = Addresses.inspect(
  // "addr_test1qz8shh6wqssr83hurdmqx44js8v7tglg9lm3xh89auw007dd38kf3ymx9c2w225uc7yjmplr794wvc96n5lsy0wsm8fq9n5epq",
     "addr_test1qzhmts2nhr3fpag0wl0ns4puqlseg5ey4hfa3n8w95x9ym0mgx64n2gpvmhy8ru6m08307wwv7q25hmtxafd5end5eusk8c8vd",
);
console.log(`>>> Thụ hưởng.hash: ${paymentBeneficiary.hash}`); 

// giá trị Datum chứa Thời hạn chia tài sản dealinePosTx
// Hash của ông chia tài sản Owner
// Hash của ông thụ hưởng tài sản Beneficairy
const d = {
    lock_until: deadlinePosIx,
    owner: paymentOwner?.hash,
    beneficiary: paymentBeneficiary?.hash,
};

const datum = await Data.to<Vestingdatum>(d, Vestingdatum);

// Cấu trúc Redeemer
const RedeemerSchema = Data.Object({
  value: Data.Bytes,
});

type RedeemerSchema = typeof RedeemerSchema;

const lovelace_lock=19_019_019n // lock 100tADA theo yêu cầu bài tập

// === Hàn Lock UTxO =====  

export async function lockUtxo(lovelace: bigint,): Promise<string> {
  console.log("xxx Lock UTxO xxx")
  console.log("Datum lock_until: ", Number(d.lock_until));

  const tx = await lucid
    .newTx()
    .payToContract(signerbyAddress, { Inline: datum }, { lovelace })
    .validTo(Date.now() + 100000)
    .commit();

  const signedTx = await tx.sign().commit();
  const txHash = await signedTx.submit();
  return txHash;
}

// Hàn mở khóa UTxO ======

export async function unlockUtxo(redeemer: RedeemerSchema, find_vest: Data.Bytes): Promise<string> {
  // Tìm UTxO tại địa chỉ signerbyAddress
  console.log("---vvv Unlock UTxO vvv--- ")
  // console.log("")
  const utxo = (await lucid.utxosAt(signerbyAddress)).find((utxo) => {
    if (!utxo.scriptRef && utxo.datum) {
      // Giải mã utxo.datum thành đối tượng Vestingdatum
      const decodedDatum = Data.from<Vestingdatum>(utxo.datum, Vestingdatum);

      // So sánh trường owner với expectedOwner
      return decodedDatum.owner === find_vest || decodedDatum.beneficiary === find_vest;
    }
    return false;
  });
  const offsetvalid= 10 * 60 * 1000; // 10 phút
  // if (!utxo) {
  //   throw new Error("No matching UTxO found");   
  // }

  console.log(`Unlock UTxO.txhash: ${utxo.txHash}`); // Hiển thị Datum của UTxO

  const decodedDatum1 = Data.from<Vestingdatum>(utxo.datum, Vestingdatum);
  console.log("Now:              ", BigInt(lucid.utils.unixTimeToSlots(Date.now()) ));
  console.log("Now:              ", Date.now()) ;
  console.log("Datum lock_until: ", Number(decodedDatum1.lock_until));
  console.log("Time offset:      ", -Number(decodedDatum1.lock_until) + Date.now());
  console.log(`Datum owner: ${decodedDatum1.owner}`);
  console.log(`Datum beneficiary: ${decodedDatum1.beneficiary}`);
  console.log(`Redeemer: ${redeemer}`); 
 
  // Tiếp tục thực hiện giao dịch
  const tx = await lucid
    .newTx()
    .collectFrom([utxo], redeemer)
    .attachScript(vesting_scripts)
    .addSigner(paymentOwner?.hash)
    .validTo(Date.now() + offsetvalid)
    .validFrom(Date.now() - offsetvalid).commit();
  const signedTx = await tx.sign().commit();
  const txHash = await signedTx.submit(); return txHash;
}

async function main() {
  try {
    // Gọi hàm lockUtxo để khóa UTxO
    // const txHash = await lockUtxo(lovelace_lock); 

    // Gọi hàm unlockUtxo để mở khóa UTxO
    const txHash = await unlockUtxo("0b825942d01e394b83ab6a7d7a44857bfc7b136a7301f500b8685824", d.beneficiary);
    //const txHash = await unlockUtxo("0b825942d01e394b83ab6a7d7a44857bfc7b136a7301f500b8685824", d.owner);
    
   
   console.log(`Transaction hash: https://preview.cexplorer.io/tx/${txHash}`);
  } catch (error) {
    console.error("Error main :", error);
  }
}

main();
