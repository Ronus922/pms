"use client"

import { Icon } from "@/components/shared/Icon"

interface Reservation {
  id: string
  full_name: string
  is_vip: boolean
  guest_vip: boolean
  adults: number
  children: number
  source: string
  payment_status: string
  status: string
}

interface ReservationBarProps {
  reservation: Reservation
  ribbonClass: string
  style?: React.CSSProperties
}

export function ReservationBar({ reservation, ribbonClass, style }: ReservationBarProps) {
  const isVip = reservation.is_vip || reservation.guest_vip

  return (
    <div
      className={`booking-ribbon ${ribbonClass} cursor-pointer hover:shadow-md transition-shadow`}
      style={style}
      title={`${reservation.full_name} | ${reservation.status} | ${reservation.payment_status}`}
    >
      <span className="text-[12px] font-bold whitespace-nowrap truncate">
        {reservation.full_name}
      </span>
      {isVip && (
        <Icon name="star" filled size="sm" className="text-amber-500 flex-shrink-0" />
      )}
      {reservation.adults + reservation.children > 1 && (
        <span className="text-[9px] opacity-70 flex-shrink-0">
          {reservation.adults}{reservation.children > 0 ? `+${reservation.children}` : ""}
        </span>
      )}
    </div>
  )
}
