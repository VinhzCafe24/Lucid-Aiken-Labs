use aiken/collection/dict
use aiken/collection/list
use aiken/primitive/bytearray
use cardano/address.{Address}
use cardano/assets.{PolicyId}
use cardano/transaction.{Output, Transaction} as tx

pub type Action {
  Minting_NFT
  Burning_NFT
}

validator mint_send_nft(prifix_token_name: ByteArray) {
  // redeemer, policy_id, transaction đều được lấy từ transaction thực
  mint(rdmr: Action, policy_id: PolicyId, transaction: Transaction) {
    let Transaction { mint, outputs, .. } = transaction
    let four_outputs = list.length(outputs) == 4
    //The payment credential of addr_test1qz3vhmpcm2t25uyaz0g3tk7hjpswg9ud9am4555yghpm3r770t25gsqu47266lz7lsnl785kcnqqmjxyz96cddrtrhnsdzl228 is a2cbec38da96aa709d13d115dbd79060e4178d2f775a528445c3b88f
    let c2vn_addr =
      address.from_verification_key(
        #"a2cbec38da96aa709d13d115dbd79060e4178d2f775a528445c3b88f",
      )
    expect [Pair(asset_name, amount)] =
      mint
        |> assets.tokens(policy_id)
        |> dict.to_pairs()
    let sent_nft_to_c2vn = find_output(outputs, asset_name, c2vn_addr)
    when rdmr is {
      Minting_NFT -> amount == 1 && sent_nft_to_c2vn && four_outputs
      Burning_NFT -> amount == -1 && sent_nft_to_c2vn && four_outputs
    }
  }

  else(_) {
    fail
  }
}

fn find_output(outputs: List<Output>, asset_name: ByteArray, addr_cred: Address) {
  list.any(
    outputs,
    fn(output) {
      bytearray.slice(asset_name, start: 0, end: 3) == prifix_token_name && output.address.payment_credential == addr_cred.payment_credential
    },
  )
}
