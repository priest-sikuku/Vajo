"use client";

import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AFRICAN_COUNTRIES } from "@/lib/countries";
import { createClient } from "@/lib/supabase/client";

interface CountrySelectorProps {
  value: string;
  onChange: (countryCode: string) => void;
  disabled?: boolean;
}

export function CountrySelector({ value, onChange, disabled = false }: CountrySelectorProps) {
  const supabase = createClient();
  const [currentCountry, setCurrentCountry] = useState<string>(value || "");

  useEffect(() => {
    const fetchUserCountry = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("country_code")
          .eq("id", user.id)
          .single();

        if (profile?.country_code) {
          setCurrentCountry(profile.country_code);
          if (!value) {
            onChange(profile.country_code);
          }
        } else if (!value) {
          setCurrentCountry("KE");
          onChange("KE");
        }
      }
    };

    if (!value) {
      fetchUserCountry();
    }
  }, [value]);

  return (
    <div className="space-y-2">
      <Label htmlFor="country-select">Country of Trading</Label>
      <Select value={currentCountry || "KE"} onValueChange={(val) => { setCurrentCountry(val); onChange(val); }} disabled={disabled}>
        <SelectTrigger id="country-select" className="bg-white/5 border-white/10 w-full">
          <SelectValue placeholder="Select Country" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(AFRICAN_COUNTRIES).map(([code, country]) => (
            <SelectItem key={code} value={code}>
              {country.name} ({country.currency_code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-gray-500">
        Your selected country determines available payment methods and exchange rates
      </p>
    </div>
  );
}
