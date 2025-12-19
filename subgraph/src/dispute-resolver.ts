import {
  DisputeCreated,
  DisputeResolved,
  EvidenceSubmitted,
} from "../generated/DisputeResolver/DisputeResolver";
import { Dispute, Game } from "../generated/schema";

export function handleDisputeCreated(event: DisputeCreated): void {
  let dispute = new Dispute(event.params.disputeId.toHex());

  dispute.match = event.params.matchId.toHex();
  dispute.result = event.params.matchId.toHex();
  dispute.game = event.params.gameId.toHex();
  dispute.challenger = event.params.challenger;
  dispute.stakeAmount = event.params.stakeAmount;
  dispute.reason = event.params.reason;
  dispute.evidenceHash = new Uint8Array(0); // Will be updated if evidence submitted
  dispute.status = "Pending";
  dispute.createdAt = event.block.timestamp;

  dispute.save();

  // Update game dispute count
  let game = Game.load(event.params.gameId.toHex());
  if (game != null) {
    game.totalDisputes = game.totalDisputes + 1;
    game.updatedAt = event.block.timestamp;
    game.save();
  }
}

export function handleDisputeResolved(event: DisputeResolved): void {
  let dispute = Dispute.load(event.params.disputeId.toHex());

  if (dispute != null) {
    // Map uint8 status to enum
    let status = "Pending";
    if (event.params.status == 0) {
      status = "Pending";
    } else if (event.params.status == 1) {
      status = "Accepted";
    } else if (event.params.status == 2) {
      status = "Rejected";
    } else if (event.params.status == 3) {
      status = "Investigating";
    }

    dispute.status = status;
    dispute.resolver = event.params.resolver;
    dispute.resolvedAt = event.params.resolvedAt;

    dispute.save();
  }
}

export function handleEvidenceSubmitted(event: EvidenceSubmitted): void {
  let dispute = Dispute.load(event.params.disputeId.toHex());

  if (dispute != null) {
    dispute.evidenceHash = event.params.evidenceHash;
    dispute.save();
  }
}
