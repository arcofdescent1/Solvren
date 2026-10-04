import { createHmac } from "node:crypto";
import { afterEach,describe,expect,it } from "vitest";
import { billingCanWrite,subscriptionState,verifyStripeSignature } from "./billing";

const previous=process.env.STRIPE_WEBHOOK_SECRET;
afterEach(()=>{if(previous===undefined)delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET=previous;});

describe("billing authorization boundaries",()=>{
  it("accepts a valid rotated Stripe signature and rejects stale or altered payloads",()=>{
    process.env.STRIPE_WEBHOOK_SECRET="whsec_test_secret";
    const raw='{"id":"evt_123"}',now=1_800_000_000_000,timestamp=now/1000;
    const signature=createHmac("sha256",process.env.STRIPE_WEBHOOK_SECRET)
      .update(`${timestamp}.${raw}`).digest("hex");
    const header=`t=${timestamp},v1=${"0".repeat(64)},v1=${signature}`;
    expect(verifyStripeSignature(raw,header,now)).toBe(true);
    expect(verifyStripeSignature(`${raw} `,header,now)).toBe(false);
    expect(verifyStripeSignature(raw,header,now+301_000)).toBe(false);
  });

  it("withholds write access after payment failure or trial expiry",()=>{
    const now=Date.parse("2026-10-04T12:00:00Z");
    expect(billingCanWrite({status:"trial",trial_ends_at:"2026-10-04T11:59:59Z",
      current_period_end:null,last_invoice_status:null},now)).toBe(false);
    expect(billingCanWrite({status:"active",trial_ends_at:"2026-10-01T00:00:00Z",
      current_period_end:"2026-11-01T00:00:00Z",last_invoice_status:"open"},now)).toBe(false);
    expect(billingCanWrite({status:"active",trial_ends_at:"2026-10-01T00:00:00Z",
      current_period_end:"2026-11-01T00:00:00Z",last_invoice_status:"paid"},now)).toBe(true);
  });

  it("treats an attempted open invoice as past due even if Stripe still says active",()=>{
    const state=subscriptionState({id:"sub_test",object:"subscription",customer:"cus_test",
      status:"active",cancel_at_period_end:false,
      items:{data:[{price:{id:"price_test",recurring:{interval:"month"}},
        current_period_end:1_800_000_000}]},
      latest_invoice:{status:"open",attempted:true,amount_remaining:150000}});
    expect(state.status).toBe("past_due");
  });
});
