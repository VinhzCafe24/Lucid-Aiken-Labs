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
console.log(`>>> paymentOwner.hash: ${paymentOwner.hash}`); 

const vesting_scripts = lucid.newScript({
  type: "PlutusV3",
  script:"59022401010029800aba2aba1aba0aab9faab9eaab9dab9a488888896600264653001300800198041804800cdc3a400530080024888966002600460106ea800e2646644b30013370e900018059baa0018cc004c03cc030dd5000c8c040c044c044c044c044c044c044c04400646020602260226022602260226022602260220032232330010010032259800800c528456600266e3cdd71809800801c528c4cc008008c05000500e2022918081808800a44444b300159800998011bac3003301137540126eb8c050c054c054c044dd5002c4c8c8c8cc8966002601e602a6ea800a2b3001300f30153754603260340071337106eb4c064c058dd5001000c4cdc49bad30193016375400400280a22941014180b8009bad3017301437540106602a602c0026602b3001300c30123754602c602e0034c0103d87a8000a60103d8798000404497ae030123754600460246ea8004c010c044dd5004c528201e8a518acc004cc008dd6180198089baa009375c600260226ea801626464646644b3001300f301537540051598009807980a9baa3019301a003899b88001375a6032602c6ea800a266e24004dd6980c980b1baa002405114a080a0c05c004dd6980b980a1baa008330153016001330159800980618091baa30163017001a6103d87a8000a60103d8798000404497ae030123754602a60246ea8004c010c044dd5004c528201e403c8b2014300d001300d300e0013009375400716401c300800130033754011149a26cac8009",         
});

const signerbyAddress = vesting_scripts.toAddress();
console.log(`vesting address: ${signerbyAddress}`);

const Vestingdatum = Data.Object({
  lock_until: Data.Integer(),
  owner: Data.Bytes,
  beneficiary: Data.Bytes(), 
});

type Vestingdatum = typeof Vestingdatum;

const deadlineDate: Date = Date.now(); 
const offset = 60 * 60 * 1000; // 5 phút
const deadlinePosIx =BigInt((deadlineDate+offset))
console.log("deadlinePosIx: ", deadlinePosIx);

const { payment: paymentBeneficiary } = Addresses.inspect(
  "addr_test1qzhmts2nhr3fpag0wl0ns4puqlseg5ey4hfa3n8w95x9ym0mgx64n2gpvmhy8ru6m08307wwv7q25hmtxafd5end5eusk8c8vd", // Addr Befn.
);
console.log(`paymentBeneficiary.hash: ${paymentBeneficiary.hash}`); 

// Tạo Datum 
const d = {
    lock_until: deadlinePosIx,
    owner: paymentOwner?.hash,
    beneficiary: paymentBeneficiary?.hash,
};
const datum = await Data.to<Vestingdatum>(d, Vestingdatum);
const RedeemerSchema = Data.Object({
  value: Data.Bytes, 
});
type RedeemerSchema = typeof RedeemerSchema;
// Tạo một Redeemer 
const Redeemer = () => Data.to({ value: fromText("Hello world!") }, RedeemerSchema);
const lovelace_lock=19_019_019n // lock 100tADA theo yêu cầu bài tạp


// Lock UTxO 
export async function lockUtxo(lovelace: bigint,): Promise<string> {
  console.log("==Lock UTxO====")
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

// Unlock UTxO
export async function unlockUtxo(redeemer: RedeemerSchema, find_vest: Data.Bytes): Promise<string> {
  // Tìm UTxO tại địa chỉ signerbyAddress
  console.log("====Unlock UTxO===")
  const utxo = (await lucid.utxosAt(signerbyAddress)).find((utxo) => {
    if (!utxo.scriptRef && utxo.datum) {
      const decodedDatum = Data.from<Vestingdatum>(utxo.datum, Vestingdatum);
      return decodedDatum.owner === find_vest || decodedDatum.beneficiary === find_vest;
    }
    return false;
  });

  if (!utxo) {
    throw new Error("No UTxO found");   
  }

  console.log(`Unlock UTxO.txhash: ${utxo.txHash}`);
  const decodedDatum1 = Data.from<Vestingdatum>(utxo.datum, Vestingdatum);
    
  console.log("Now:     ", BigInt(lucid.utils.unixTimeToSlots(Date.now()) ));
  console.log("Now:     ", Date.now()) ;
  console.log("Datum lock_until: ", Number(decodedDatum1.lock_until));
  console.log("Time offset:  ", -Number(decodedDatum1.lock_until) + Date.now());
  console.log(`Datum owner: ${decodedDatum1.owner}`);
  console.log(`Datum beneficiary: ${decodedDatum1.beneficiary}`);
  console.log(`Redeemer: ${redeemer}`); 
 
  const offsetvalid= 1 * 60 * 1000; // 1 phút
  const tx = await lucid
    .newTx()
    .collectFrom([utxo], redeemer)
    .attachScript(vesting_scripts)
    .addSigner(paymentOwner?.hash)
    .validTo(Date.now() + offsetvalid)
    .validFrom(Date.now() - offsetvalid)
    .commit();
  const signedTx = await tx.sign().commit();
  const txHash = await signedTx.submit();
  return txHash;
}

async function main() {
  try {
    // Gọi hàm lockUtxo để khóa UTxO
    // const txHash = await lockUtxo(lovelace_lock); 

    // Gọi hàm unlockUtxo để mở khóa UTxO
    // const txHash = await unlockUtxo(Redeemer(), d.owner);
    const txHash = await unlockUtxo(Redeemer(), d.beneficiary);

  console.log(`Transaction hash: https://preview.cexplorer.io/tx/${txHash}`);
  } catch (error) {
    console.error("Error main :", error);
  }
}

main();
