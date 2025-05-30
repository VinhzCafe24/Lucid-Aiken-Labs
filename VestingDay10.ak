use aiken/crypto.{VerificationKeyHash}
use cardano/transaction.{OutputReference, Transaction}

use vodka_extra_signatories.{key_signed}
use vodka_validity_range.{valid_after}
use vodka_validity_range.{valid_before}

pub type VestingDatum {
    lock_until: Int,
    owner: VerificationKeyHash,
    beneficiary: VerificationKeyHash,
}

validator vesting {
spend(datum_opt: Option<VestingDatum>, _redeemer: Data, _input: OutputReference, tx: Transaction,) {
    expect Some(datum) = datum_opt
    or {
        and {
            key_signed(tx.extra_signatories, datum.owner),
            valid_before(tx.validity_range, datum.lock_until),  
        },
        and {
            key_signed(tx.extra_signatories, datum.beneficiary),
            valid_after(tx.validity_range, datum.lock_until),
        },
    }
}
    else(_) { fail}
}
