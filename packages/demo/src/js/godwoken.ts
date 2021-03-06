import { Hash, HexString, utils } from "@ckb-lumos/base";
import {
  Godwoken,
  Uint32,
  Uint128,
  RawL2Transaction,
  GodwokenUtils,
  L2Transaction,
  WithdrawalRequest,
} from "@godwoken-examples/godwoken";
import {
  NormalizeSUDTQuery,
  NormalizeSUDTTransfer,
  SUDTQuery,
  SUDTTransfer,
  UnoinType,
} from "@godwoken-examples/godwoken/lib/normalizer";
import { SerializeSUDTArgs } from "@godwoken-examples/godwoken/schemas";
import { Reader } from "ckb-js-toolkit";
import { getRollupTypeHash } from "./transactions/deposition";
import { sign } from "./utils/eth_sign";
import { godwokenUrl } from "./url";
import { LocalNonce } from "./utils/nonce";

/**
 *
 * @param fromId
 * @param toId sudt id
 * @param accountId
 */
export async function query(
  fromId: Uint32,
  toId: Uint32,
  accountId: Uint32
): Promise<Uint128> {
  console.log("--- godwoken sudt query ---");
  const godwoken = new Godwoken(godwokenUrl);
  // const nonce: Uint32 = await godwoken.getNonce(fromId);
  const nonce: Uint32 = await LocalNonce.getNonce(fromId, godwoken);

  const sudtQuery: SUDTQuery = {
    account_id: "0x" + accountId.toString(16),
  };

  const sudtArgs: UnoinType = {
    type: "SUDTQuery",
    value: NormalizeSUDTQuery(sudtQuery),
  };

  const serializedSudtArgs = new Reader(
    SerializeSUDTArgs(sudtArgs)
  ).serializeJson();

  console.log("serialized sudt args:", sudtArgs);

  const rawL2Transaction: RawL2Transaction = {
    from_id: "0x" + fromId.toString(16),
    to_id: "0x" + toId.toString(16),
    nonce: "0x" + nonce.toString(16),
    args: serializedSudtArgs,
  };

  const rollupTypeHash: Hash = getRollupTypeHash();
  const godwokenUtils = new GodwokenUtils(rollupTypeHash);
  const message = godwokenUtils.generateTransactionMessageToSign(
    rawL2Transaction
  );

  const signature: HexString = await sign(message);

  const l2Transaction: L2Transaction = {
    raw: rawL2Transaction,
    signature,
  };

  const runResult = await godwoken.executeL2Transaction(l2Transaction);
  console.log("runResult:", runResult);

  const errorMessage: string | undefined = (runResult as any).message;
  if (errorMessage) {
    throw new Error(errorMessage);
  }

  const returnData = runResult.return_data;
  const result = utils.readBigUInt128LE(returnData);

  console.log("query result:", result);

  console.log("--- godwoken sudt query finished ---");
  return result;
}

export async function transfer(
  fromId: Uint32,
  toId: Uint32,
  sudtId: Uint32,
  amount: Uint128,
  fee: Uint128
) {
  console.log("--- godwoken sudt transfer ---");
  const godwoken = new Godwoken(godwokenUrl);
  const nonce: Uint32 = await LocalNonce.getNonce(fromId, godwoken);

  const sudtTransfer: SUDTTransfer = {
    to: "0x" + toId.toString(16),
    amount: "0x" + amount.toString(16),
    fee: "0x" + fee.toString(16),
  };

  const sudtArgs: UnoinType = {
    type: "SUDTTransfer",
    value: NormalizeSUDTTransfer(sudtTransfer),
  };

  const serializedSudtArgs = new Reader(
    SerializeSUDTArgs(sudtArgs)
  ).serializeJson();

  console.log("serialized sudt args:", sudtArgs);

  const rawL2Transaction: RawL2Transaction = {
    from_id: "0x" + fromId.toString(16),
    to_id: "0x" + sudtId.toString(16),
    nonce: "0x" + nonce.toString(16),
    args: serializedSudtArgs,
  };

  const rollupTypeHash: Hash = getRollupTypeHash();
  const godwokenUtils = new GodwokenUtils(rollupTypeHash);
  const message = godwokenUtils.generateTransactionMessageToSign(
    rawL2Transaction
  );

  const signature: HexString = await sign(message);

  const l2Transaction: L2Transaction = {
    raw: rawL2Transaction,
    signature,
  };

  // const runResult = await godwoken.executeL2Transaction(l2Transaction);
  const runResult = await godwoken.submitL2Transaction(l2Transaction);
  console.log("runResult:", runResult);

  const errorMessage: string | undefined = (runResult as any).message;
  if (errorMessage) {
    throw new Error(errorMessage);
  }

  LocalNonce.increaseNonce();

  console.log("--- godwoken sudt transfer finished ---");
  return;
}

export async function withdraw(
  fromId: Uint32,
  capacity: bigint,
  amount: bigint,
  sudtScriptHash: Hash,
  accountScriptHash: Hash,
  ownerLockHash: Hash
) {
  console.log("--- godwoken withdraw ---");

  const godwoken = new Godwoken(godwokenUrl);
  // const nonce: Uint32 = await godwoken.getNonce(fromId);
  const nonce: Uint32 = await LocalNonce.getNonce(fromId, godwoken);
  console.log("nonce:", nonce);

  const rawWithdrawalRequest = GodwokenUtils.createRawWithdrawalRequest(
    nonce,
    capacity,
    amount,
    sudtScriptHash,
    accountScriptHash,
    BigInt(0),
    BigInt(100 * 10 ** 8),
    ownerLockHash,
    "0x" + "0".repeat(64)
  );

  const godwokenUtils = new GodwokenUtils(getRollupTypeHash());
  const message = godwokenUtils.generateWithdrawalMessageToSign(
    rawWithdrawalRequest
  );

  const signature: HexString = await sign(message);

  const withdrawalRequest: WithdrawalRequest = {
    raw: rawWithdrawalRequest,
    signature: signature,
  };

  console.log("withdrawalRequest:", withdrawalRequest);

  const result = await godwoken.submitWithdrawalRequest(withdrawalRequest);
  console.log("result:", result);

  const errorMessage = (result as any).message;
  if (errorMessage !== undefined && errorMessage !== null) {
    throw new Error(errorMessage);
  }

  LocalNonce.increaseNonce();

  console.log("--- godwoken withdraw finished ---");
  return result;
}
