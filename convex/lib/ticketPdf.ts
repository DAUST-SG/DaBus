import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { Ticket } from "../tickets";

// Standard PDF fonts only cover Western European characters; swap anything else so it can't crash
const safe = (text: string) => text.replace(/→/g, "to").replace(/[^\x20-\x7E -ÿ]/g, "?");

// The ticket as an A5 PDF with a QR code linking to its page. Used by the "Download ticket"
// route and attached to the ticket email, so both are always the same document.
export const buildTicketPdf = async (ticket: Ticket, link: string): Promise<Uint8Array> => {
  const trip = ticket.trip!;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 595]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const accent = rgb(0.91, 0.64, 0.19);
  const dark = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.42, 0.42, 0.46);

  page.drawRectangle({ x: 0, y: 515, width: 420, height: 80, color: dark });
  page.drawText("DaBus", { x: 30, y: 552, size: 26, font: bold, color: accent });
  page.drawText("DAUST student shuttle - boarding ticket", { x: 30, y: 532, size: 10, font: regular, color: rgb(0.85, 0.85, 0.85) });

  let y = 480;
  const line = (label: string, value: string, size = 13) => {
    page.drawText(safe(label).toUpperCase(), { x: 30, y, size: 8, font: regular, color: muted });
    page.drawText(safe(value), { x: 30, y: y - 16, size, font: bold, color: dark });
    y -= 42;
  };
  page.drawText(safe(`${trip.origin} to ${trip.destination}`), { x: 30, y, size: 20, font: bold, color: dark });
  y -= 40;
  const day = new Date(`${trip.departure_date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Dakar",
  });
  line("Departure (Dakar time)", `${day} at ${trip.departure_time}`);
  line("Passenger", ticket.full_name || "-");
  if (ticket.pickup_location) line("Pickup", ticket.pickup_time ? `${ticket.pickup_location} at ${ticket.pickup_time}` : ticket.pickup_location);
  if (ticket.dropoff_location) line("Drop-off", ticket.dropoff_location);
  line("Paid", `${String(ticket.amount ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} CFA`);
  line("Ticket", ticket.ref, 18);

  const qr = await pdf.embedPng(await QRCode.toBuffer(link, { margin: 1, width: 300 }));
  page.drawImage(qr, { x: 250, y: 300, width: 140, height: 140 });
  page.drawText("Show this to the driver", { x: 262, y: 286, size: 9, font: regular, color: muted });
  page.drawText("Valid for this trip only. Keep it until you arrive.", { x: 30, y: 40, size: 9, font: regular, color: muted });

  return pdf.save();
};
