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
  script:"",         
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
  "", // Addr Befn.
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
const lovelace_lock=19_019_019n 


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
