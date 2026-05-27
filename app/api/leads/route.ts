import { NextRequest, NextResponse } from "next/server";
import { getAdminMaxLeads, isAdminRequest } from "../admin-auth";
import { getSessionUser } from "../../lib/auth";
import { newId, readDb, writeDb } from "../../lib/db";
import { getPlanConfig } from "../../lib/plans";

type PlacesNearbyResult = {
  place_id: string;
  name?: string;
  vicinity?: string;
  rating?: number;
  types?: string[];
};

type NearbySearchResponse = {
  results: PlacesNearbyResult[];
  next_page_token?: string;
};

type PlaceDetailsResult = {
  formatted_address?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  url?: string;
};

type Lead = {
  id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  mapsLink: string;
  rating: string;
  category: string;
  emailStatus?: string;
};

const milesToMeters = (miles: number) => Math.round(miles * 1609.344);

const wait = (milliseconds: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const titleCase = (value: string) =>
  value
    .replaceAll("_", " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

async function fetchGoogleJson<T>(url: string) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Google API request failed with status ${response.status}`);
  }

  return (await response.json()) as T & {
    status?: string;
    error_message?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey || apiKey === "your_api_key_here") {
      return NextResponse.json(
        { error: "Add GOOGLE_MAPS_API_KEY to your .env file before searching." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as {
      businessType?: string;
      zipCode?: string;
      location?: string;
      radiusMiles?: number;
      resultLimit?: number;
      quantity?: number;
      plan?: string;
      adminMode?: boolean;
    };

    const sessionUser = await getSessionUser(request);
    const isAdmin = sessionUser?.plan === "admin" || (body.adminMode === true && isAdminRequest(request));

    if (!sessionUser && !isAdmin) {
      return NextResponse.json(
        { error: "Login required. Please sign in before searching leads." },
        { status: 401 },
      );
    }

    const businessType = body.businessType?.trim();
    const zipCode = body.zipCode?.trim() || body.location?.trim();
    const radiusMiles = Number(body.radiusMiles);
    const requestedResultLimit = Number(body.quantity || body.resultLimit);
    const sessionPlan = sessionUser ? getPlanConfig(sessionUser.plan) : null;
    const publicPlanLimit = sessionPlan?.leadLimit || 20;
    const adminRequestedLimit =
      Number.isFinite(requestedResultLimit) && requestedResultLimit > 0
        ? Math.floor(requestedResultLimit)
        : 50;
    const dbForCredits = sessionUser ? await readDb() : null;
    const dbUser = dbForCredits?.users.find((candidate) => candidate.id === sessionUser?.id);
    const remainingCredits = isAdmin ? null : dbUser?.creditsRemaining ?? publicPlanLimit;
    const resultLimit = isAdmin
      ? Math.min(adminRequestedLimit, getAdminMaxLeads())
      : Math.min(adminRequestedLimit, publicPlanLimit, remainingCredits || 0);

    if (!businessType || !zipCode || !Number.isFinite(radiusMiles) || radiusMiles <= 0) {
      return NextResponse.json(
        { error: "Business type, ZIP code, and radius are required." },
        { status: 400 },
      );
    }

    if (!isAdmin && sessionUser && Number.isFinite(requestedResultLimit) && requestedResultLimit > (remainingCredits || 0)) {
      return NextResponse.json(
        { error: `You only have ${remainingCredits || 0} lead credits remaining.` },
        { status: 402 },
      );
    }

    if (!isAdmin && sessionUser && (remainingCredits || 0) <= 0) {
      return NextResponse.json(
        { error: "You are out of lead credits. Upgrade your plan to keep searching." },
        { status: 402 },
      );
    }

    const radiusMeters = Math.min(milesToMeters(radiusMiles), 50000);
    const geocodeUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    geocodeUrl.searchParams.set("address", zipCode);
    geocodeUrl.searchParams.set("components", "country:US");
    geocodeUrl.searchParams.set("key", apiKey);

    const geocode = await fetchGoogleJson<{
      results: Array<{ geometry: { location: { lat: number; lng: number } } }>;
    }>(geocodeUrl.toString());

    if (geocode.status !== "OK" || geocode.results.length === 0) {
      return NextResponse.json(
        { error: geocode.error_message || "Could not find that ZIP code." },
        { status: 404 },
      );
    }

    const { lat, lng } = geocode.results[0].geometry.location;
    const placesUrl = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    placesUrl.searchParams.set("location", `${lat},${lng}`);
    placesUrl.searchParams.set("radius", String(radiusMeters));
    placesUrl.searchParams.set("keyword", businessType);
    placesUrl.searchParams.set("key", apiKey);

    const nearby = await fetchGoogleJson<NearbySearchResponse>(placesUrl.toString());

    if (nearby.status !== "OK" && nearby.status !== "ZERO_RESULTS") {
      return NextResponse.json(
        { error: nearby.error_message || "Google Places search failed." },
        { status: 502 },
      );
    }

    const places = [...nearby.results];
    let nextPageToken = nearby.next_page_token;
    let page = 0;

    while (nextPageToken && places.length < resultLimit && page < 49) {
      await wait(2000);

      const pagedPlacesUrl = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
      pagedPlacesUrl.searchParams.set("pagetoken", nextPageToken);
      pagedPlacesUrl.searchParams.set("key", apiKey);

      const pagedNearby = await fetchGoogleJson<NearbySearchResponse>(pagedPlacesUrl.toString());

      if (pagedNearby.status !== "OK") {
        break;
      }

      places.push(...pagedNearby.results);
      nextPageToken = pagedNearby.next_page_token;
      page += 1;
    }

    const details = await Promise.all(
      places.slice(0, resultLimit).map(async (place) => {
        const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        detailsUrl.searchParams.set("place_id", place.place_id);
        detailsUrl.searchParams.set(
          "fields",
          "formatted_address,formatted_phone_number,international_phone_number,website,url",
        );
        detailsUrl.searchParams.set("key", apiKey);

        const detailResponse = await fetchGoogleJson<{ result: PlaceDetailsResult }>(
          detailsUrl.toString(),
        );

        return { place, detail: detailResponse.result || {} };
      }),
    );

    const leads: Lead[] = details.map(({ place, detail }) => {
      const firstType = place.types?.find((type) => type !== "point_of_interest" && type !== "establishment");

      return {
        id: place.place_id,
        name: place.name || "Unknown business",
        address: detail.formatted_address || place.vicinity || "Not available",
        phone:
          detail.formatted_phone_number ||
          detail.international_phone_number ||
          "Not available",
        website: detail.website || "",
        mapsLink:
          detail.url ||
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            place.name || businessType,
          )}&query_place_id=${place.place_id}`,
        rating: typeof place.rating === "number" ? place.rating.toFixed(1) : "Not rated",
        category: firstType ? titleCase(firstType) : titleCase(businessType),
        emailStatus: "Not checked",
      };
    });

    let creditsUsed = 0;

    if (sessionUser && dbForCredits) {
      const user = dbForCredits.users.find((candidate) => candidate.id === sessionUser.id);

      if (user) {
        user.totalSearches += 1;
        const chargedLeadIds = new Set(user.chargedLeadIds || []);
        const newlyChargedLeads = isAdmin ? [] : leads.filter((lead) => !chargedLeadIds.has(lead.id));
        creditsUsed = newlyChargedLeads.length;

        if (!isAdmin) {
          user.creditsRemaining = Math.max(0, (user.creditsRemaining || 0) - creditsUsed);
          user.chargedLeadIds = Array.from(new Set([...chargedLeadIds, ...newlyChargedLeads.map((lead) => lead.id)]));
        }
      }

      dbForCredits.searchHistory.push({
        id: newId("search"),
        userId: sessionUser.id,
        userEmail: sessionUser.email,
        businessType,
        zipCode,
        location: zipCode,
        radiusMiles,
        quantityRequested: resultLimit,
        resultCount: leads.length,
        creditsUsed,
        generatedResults: leads,
        createdAt: new Date().toISOString(),
      });

      await writeDb(dbForCredits);
    }

    return NextResponse.json({
      leads,
      location: { lat, lng },
      radiusMeters,
      mode: isAdmin ? "admin" : "public",
      maxLeads: resultLimit,
      creditsUsed,
      creditsRemaining: isAdmin ? null : dbUser?.creditsRemaining ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
