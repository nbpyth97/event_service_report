import type { ReactNode } from "react";
import type { CompanySettings, Service } from "@/api/client";
import CalendarGrid from "@/components/CalendarGrid";
import TimeSlotList from "@/components/booking/TimeSlotList";
import { fmtPrice } from "@/lib/format";

// The pick-a-day-then-a-time half of booking, shared by the two surfaces that
// need it: the public page where a customer books for themselves, and the
// staff page where an admin books on a customer's behalf. Neither fetches in
// here — slots arrive as a prop, because the two read from different
// endpoints (usePublicAvailability vs. useAvailability).
//
// Everything that differs is passed in. The two flows even disagree on *when*
// the customer is identified: staff pick one up front (`identity`, with
// `canPickTime` false until they have), while a public visitor picks a time
// first and gives their name and phone in the confirm step (`children`).
export default function ServiceBookingFlow({
  service,
  businessHours,
  back,
  eyebrow,
  identity,
  canPickTime = true,
  selectedDate,
  onSelectDate,
  slots,
  slotsLoading,
  selectedSlot,
  onSelectSlot,
  children,
}: {
  service: Service;
  businessHours: CompanySettings["business_hours"];
  back: ReactNode;
  eyebrow?: ReactNode;
  identity?: ReactNode;
  canPickTime?: boolean;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  slots: string[];
  slotsLoading: boolean;
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
  children?: ReactNode;
}) {
  return (
    <>
      <header className="booking-header">
        <div className="public-booking-topbar">
          {eyebrow}
          {back}
        </div>
        <h1>{service.name}</h1>
        <p className="sub">
          {service.duration_min} min · {fmtPrice(service.price)}
        </p>
      </header>

      {identity}

      {canPickTime && (
        <div className="booking-layout">
          <CalendarGrid businessHours={businessHours} selectedDate={selectedDate} onSelectDate={onSelectDate} />
          {selectedDate && (
            <TimeSlotList
              slots={slots}
              isLoading={slotsLoading}
              selectedSlot={selectedSlot}
              onSelectSlot={onSelectSlot}
            />
          )}
        </div>
      )}

      {children}
    </>
  );
}
