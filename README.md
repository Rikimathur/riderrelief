# RiderRelief

Parametric insurance for gig and delivery workers. When bad weather hits your zone while you're working, you get paid — automatically. No forms, no calls, no "we'll get back to you in 5-7 business days."

---

## Why we built this

Think about what a delivery worker actually deals with. It rains hard enough to shut down half the city, and they have two options — go out and risk it, or stay home and eat the loss. There's no third option. No paid leave, no WFH policy, no safety net.

Normal insurance doesn't work for them. The paperwork alone takes longer than their shift. And even if they do file something, "proving" income loss as a gig worker is its own nightmare.

Parametric insurance is a different approach entirely. You don't prove loss. You just verify the trigger — did the weather event happen, was the worker in that zone, was it severe enough. If yes, the payout goes. That's the whole model.

What we had to figure out is how to make sure that trigger can't be faked.

---

## Basic flow

Worker signs up, sets their city zone and active hours. They don't have to do anything after that. When our system detects a qualifying weather event in their zone during their active window, it runs the claim through verification automatically. If it clears, money goes to their account. The whole thing is supposed to feel like it just happened, not like they filed for something.

---

## Stack

- FastAPI on the backend
- PostgreSQL
- OpenWeatherMap for weather data
- React Native on the frontend
- Device sensors through mobile SDK — GPS, accelerometer, gyroscope
- Scikit-learn and TensorFlow Lite for the ML bits
- UPI for payouts

---

## How the system is built

Three parts doing three different jobs.

First is ingestion — this just pulls everything in continuously while a worker is active. Device sensors, weather API data, network signal quality, cell tower info. All of it gets logged with timestamps.

Second is the verification engine — this is where the actual decision-making happens. Multiple checks run at the same time, each one looking at the situation from a different angle. We'll get into this in detail below because it's the most important part.

Third is the payout layer — manages the liquidity pool, handles the conditional logic around when to pay immediately vs when to hold, and executes the transfer.

---

## Adversarial Defense and Anti-Spoofing Strategy

We're going to be direct about this because it's not a hypothetical problem.

A group of 500 delivery workers coordinating over Telegram, all running GPS spoofing apps, all faking their location to a storm-affected zone — that's a real attack. It happened on another platform. Their liquidity pool got drained in one wave. The spoofing apps are free to download, they're easy to use, and organizing people to run them at the same time takes maybe a few hours of group chat.

If all we're doing is checking whether GPS coordinates fall inside a weather zone, we lose. Full stop.

So we built six layers of verification that all have to be consistent with each other. You can fake a GPS coordinate with an app. What you can't easily fake is having every single sensor on your phone also agree with that fake location, all at the same time, in a way that matches how a real person moving through a real storm would look.

---

### Layer 1 — Behavioral Reality Scoring

The core idea is simple: someone actually out in a storm behaves differently from someone sitting at home with a spoofing app open. We try to measure that.

We pull four signals and roll them into one trust score.

**Accelerometer / movement check**

We look at the last 10-15 minutes of accelerometer data. A real person outside — even if they've stopped because of flooding or whatever — still produces movement. Phone shifts in a pocket, wind vibrations, adjusting position. A phone sitting on a table at home is almost perfectly still. If we see near-zero accelerometer variance over a sustained window right before and during a claim, that's a flag.

**Route and speed patterns**

Everyone who does delivery work regularly has a pattern. Their usual areas, their average speed, the general routes they take. We compare current GPS behaviour against that history. A jump of several kilometres in a few seconds is physically impossible and gets caught immediately. Someone whose entire work history is in one part of the city suddenly claiming to be stranded in a zone they've never been to — that also raises the score.

**Network quality**

Storms degrade cell networks. That's just how it works — tower congestion, interference. So if someone is claiming to be in the middle of a red-alert weather zone and their network signal is clean and strong, that's worth looking at. We pull basic signal strength and latency and factor it in. It's not the most powerful signal but it costs almost nothing to check and it catches lazy attacks.

**Weather cross-check**

We take the reported GPS coordinates and query the weather API directly. If the GPS says storm zone but the API says clear at those coordinates, the claim fails here. Simple check, catches simple fraud.

All four of these combine into a score between 0 and 1. High score — done, claim passes. Low score — goes deeper.

---

### Layer 2 — Sensor Fusion

GPS is one input. The phone has a lot of other sensors and they all have opinions.

When someone is actually riding through bad weather, their gyroscope shows rotation and tilt that matches that movement. Their accelerometer shows the kind of vibration you get from a road surface. These things are consistent with each other and consistent with the GPS.

A spoofing app only touches the GPS. It doesn't reprogram the gyroscope or the accelerometer. So when the sensors disagree with each other — when the GPS says "moving through storm zone" but the gyroscope says "stationary on a flat surface" — that inconsistency is the tell.

The ML model here is trained on real delivery telemetry so it has a baseline for what genuine movement in bad weather actually looks like at the sensor level. Not just coordinates — the whole picture.

---

### Layer 3 — Weather Correlation

More thorough version of the weather cross-check from Layer 1.

We're not just verifying that rain exists at a coordinate. We're verifying that the specific event matches the payout trigger — right severity, right time window, right geographic coverage. A worker filing for a storm payout needs an actual qualifying storm to be active in their zone at that moment.

We also maintain a log of recent weather events. Someone trying to replay yesterday's storm data gets caught here — the event timestamp doesn't match the claim window.

---

### Layer 4 — Crowd Validation

This is probably the most effective layer against coordinated attacks specifically.

A real storm affects everyone in a zone. When one actually hits, we'd see dozens of workers across that area all producing consistent sensor data — because they're genuinely in the same conditions. Their accelerometers agree with each other. Their network quality matches. Their movement patterns make sense for the same environment. That collective agreement cross-validates individual claims without anyone doing anything extra.

Fraud looks completely different. A group spoofing the same zone will have GPS that clusters, but everything else — movement patterns, network fingerprints, sensor readings — won't line up the way it would for people who are actually there together. The GPS agrees, the rest doesn't.

We also catch one device running multiple accounts here. If five accounts are showing identical sensor variance and the same network identifiers, it's the same phone. That gets flagged immediately.

---

### Layer 5 — Verification Step for Flagged Claims

If a claim gets flagged after the automated layers, it doesn't get rejected. It gets asked a question.

We ask the worker to submit a short video — ten seconds, just their surroundings. What the street looks like. What the sky looks like. That's enough to confirm conditions and it takes less than a minute.

The important thing is we only ask when we actually need it. A worker with a clean history and consistent sensors goes straight through. This step exists for the cases where the automated signals are ambiguous and we genuinely can't call it either way.

There's also a specific edge case we had to think through — a worker whose connectivity was patchy during the claim window. Bad weather causes bad network. We don't reject someone for missing data that they couldn't send because of the conditions they're claiming. We give them a window after connectivity restores to submit the confirmation. Punishing a worker for a network drop caused directly by the storm they're claiming for would completely undermine what we're trying to do.

Honest worker in a real storm should barely notice any of this. The friction is supposed to go to the person trying to game the system, not the person trying to use it properly.

---

### Layer 6 — Conditional Payouts

Sometimes verification takes time. We don't want a genuine worker sitting in a flooded street with nothing while we finish checking things.

If the claim passes everything with a high confidence score — payout is immediate.

If it's flagged but not conclusively fraud — we release a partial advance, roughly 50%, within the hour. The rest holds until review is done. Worker isn't left with zero, pool isn't fully exposed.

If the fraud signal is strong — full hold, goes to human review. And the worker gets a proper notification. Not "claim under review, please wait." Actual information — what we found, what we need from them, when they'll hear back.

There's also a circuit breaker at the pool level. If claim volume from one zone spikes way beyond what a storm of that severity would normally generate based on historical data, payouts from that zone get capped temporarily and the spike gets reviewed. This is the direct answer to the pool-drain attack. A coordinated wave of fake claims hits a rate limit before it empties anything.

---

## Why this is hard to beat

Spoofing GPS takes five minutes and a free app. But the six layers above aren't checking GPS in isolation — they're checking whether the entire picture is internally consistent. Accelerometer, gyroscope, network quality, weather data, crowd patterns, claim history. All of it.

Making all of those agree with a fake location, simultaneously, in a way that looks like a real person in real conditions — that's not something you pull off with a Telegram group and a spoofing app. The attack gets a lot harder. The payout stays the same. That math works in our favour.

And on the other side — the worker who's genuinely stuck in a storm, connectivity dropping, trying to just get through their day — they don't feel most of this. The system trusts them first and asks questions second.

---

## Team

Team Aurora  
DEVTrails 2026 — Guidewire University Hackathon
