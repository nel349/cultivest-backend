import express from "express";
import { supabase } from "../../../utils/supabase";

const router = express.Router();

router.get("/:transactionId", async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { userID } = req.query;

        if (!userID) {
            return res
                .status(400)
                .json({ error: "userID query parameter required" });
        }

        console.log("📊 Checking deposit status:", { transactionId, userID });

        // Get deposit record with user verification
        const { data: deposit, error: depositError } = await supabase
            .from("deposits")
            .select(
                `
        deposit_id,
        user_id,
        amount_usd,
        amount_algo,
        amount_usdca,
        amount_btc,
        target_currency,
        target_address,
        status,
        fees_paid,
        conversion_rate,
        moonpay_transaction_id,
        algorand_tx_id,
        error_message,
        created_at,
        updated_at,
        completed_at,
        expires_at
      `
            )
            .eq("deposit_id", transactionId)
            .eq("user_id", userID) // Verify user owns this deposit
            .single();

        if (depositError || !deposit) {
            return res.status(404).json({
                error: "Deposit not found or access denied",
            });
        }

        // Calculate progress percentage
        const statusProgress = {
            pending_payment: 25,
            processing: 50,
            crypto_received: 75,
            completed: 100,
            failed: 0,
            cancelled: 0,
            expired: 0,
        };

        const progress =
            statusProgress[deposit.status as keyof typeof statusProgress] || 0;

        // Check if deposit has expired
        const isExpired = new Date() > new Date(deposit.expires_at);
        const effectiveStatus =
            isExpired && deposit.status === "pending_payment"
                ? "expired"
                : deposit.status;

        // Format response
        const response = {
            success: true,
            deposit: {
                id: deposit.deposit_id,
                userId: deposit.user_id,
                amount: {
                    usd: deposit.amount_usd,
                    crypto:
                        deposit.target_currency === "btc"
                            ? deposit.amount_btc
                            : deposit.target_currency === "algo"
                            ? deposit.amount_algo
                            : deposit.amount_usdca,
                },
                currency: deposit.target_currency,
                targetAddress: deposit.target_address,
                status: effectiveStatus,
                progress: progress,
                fees: deposit.fees_paid,
                conversionRate: deposit.conversion_rate,
                transactions: {
                    moonpay: deposit.moonpay_transaction_id,
                    blockchain: deposit.algorand_tx_id,
                },
                timestamps: {
                    created: deposit.created_at,
                    updated: deposit.updated_at,
                    completed: deposit.completed_at,
                    expires: deposit.expires_at,
                },
                error: deposit.error_message,
            },
        };

        return res.json(response);
    } catch (error) {
        console.error("Deposit status check error:", error);
        return res.status(500).json({
            error: "Internal server error while checking deposit status",
        });
    }
});

export default router;
