import nodemailer from "nodemailer";

export interface BookingEmailData {
  to: string;
  bookingReference: string;
  movieName: string;
  theatreName: string;
  screenName: string;
  showDate: string;
  showTime: string;
  seats: string[];
  amount: number;
}

function getTransporter() {
  const host =
    process.env.SMTP_HOST;

  const port =
    Number(
      process.env.SMTP_PORT ||
        2525
    );

  const user =
    process.env.SMTP_USER;

  const pass =
    process.env.SMTP_PASS;

  if (!host) {
    throw new Error(
      "SMTP_HOST is missing in .env"
    );
  }

  if (!user) {
    throw new Error(
      "SMTP_USER is missing in .env"
    );
  }

  if (!pass) {
    throw new Error(
      "SMTP_PASS is missing in .env"
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

function getSenderEmail(): string {
  const from =
    process.env.SMTP_FROM ||
    process.env.SMTP_USER;

  if (!from) {
    throw new Error(
      "SMTP_FROM or SMTP_USER is missing in .env"
    );
  }

  return from;
}

function escapeHtml(
  value: string
): string {
  return value
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

function createEmailHtml(
  data: BookingEmailData,
  type: "confirmed" | "cancelled"
): string {
  const isConfirmed =
    type === "confirmed";

  const title =
    isConfirmed
      ? "🎬 Booking Confirmed"
      : "Booking Cancelled";

  const subtitle =
    isConfirmed
      ? "Your movie ticket booking is confirmed."
      : "Your movie booking has been cancelled.";

  const intro =
    isConfirmed
      ? "Your booking has been successfully confirmed."
      : "Your booking cancellation has been processed successfully.";

  const reference =
    escapeHtml(
      data.bookingReference
    );

  const movie =
    escapeHtml(
      data.movieName
    );

  const theatre =
    escapeHtml(
      data.theatreName
    );

  const screen =
    escapeHtml(
      data.screenName
    );

  const date =
    escapeHtml(
      data.showDate
    );

  const time =
    escapeHtml(
      data.showTime
    );

  const seats =
    data.seats
      .map(escapeHtml)
      .join(", ");

  const amount =
    Number(data.amount).toFixed(
      2
    );

  const amountLabel =
    isConfirmed
      ? "TOTAL AMOUNT"
      : "BOOKING AMOUNT";

  const finalMessage =
    isConfirmed
      ? "Please keep this booking reference for your records. We look forward to seeing you at the movies!"
      : "If this booking was already paid, the refund process will be handled according to the payment/refund policy.";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
</head>

<body
  style="
    margin: 0;
    padding: 0;
    background-color: #f4f4f4;
    font-family: Arial, Helvetica, sans-serif;
  "
>
  <div
    style="
      max-width: 600px;
      margin: 30px auto;
      background-color: #ffffff;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
    "
  >
    <div
      style="
        background-color: #111827;
        color: #ffffff;
        padding: 25px;
        text-align: center;
      "
    >
      <h1
        style="
          margin: 0;
          font-size: 26px;
        "
      >
        ${title}
      </h1>

      <p style="margin: 8px 0 0;">
        ${subtitle}
      </p>
    </div>

    <div style="padding: 30px;">
      <p style="font-size: 16px;">
        ${intro}
      </p>

      <div
        style="
          background-color: #f3f4f6;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
          text-align: center;
        "
      >
        <p
          style="
            margin: 0 0 5px;
            color: #6b7280;
            font-size: 13px;
          "
        >
          BOOKING REFERENCE
        </p>

        <strong
          style="
            font-size: 20px;
            letter-spacing: 1px;
          "
        >
          ${reference}
        </strong>
      </div>

      <h3>
        ${isConfirmed
          ? "Movie Details"
          : "Cancelled Booking Details"}
      </h3>

      <table
        style="
          width: 100%;
          border-collapse: collapse;
          font-size: 15px;
        "
      >
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">
            Movie
          </td>
          <td
            style="
              padding: 8px 0;
              text-align: right;
              font-weight: bold;
            "
          >
            ${movie}
          </td>
        </tr>

        <tr>
          <td style="padding: 8px 0; color: #6b7280;">
            Theatre
          </td>
          <td
            style="
              padding: 8px 0;
              text-align: right;
              font-weight: bold;
            "
          >
            ${theatre}
          </td>
        </tr>

        <tr>
          <td style="padding: 8px 0; color: #6b7280;">
            Screen
          </td>
          <td
            style="
              padding: 8px 0;
              text-align: right;
              font-weight: bold;
            "
          >
            ${screen}
          </td>
        </tr>

        <tr>
          <td style="padding: 8px 0; color: #6b7280;">
            Date
          </td>
          <td
            style="
              padding: 8px 0;
              text-align: right;
              font-weight: bold;
            "
          >
            ${date}
          </td>
        </tr>

        <tr>
          <td style="padding: 8px 0; color: #6b7280;">
            Time
          </td>
          <td
            style="
              padding: 8px 0;
              text-align: right;
              font-weight: bold;
            "
          >
            ${time}
          </td>
        </tr>

        <tr>
          <td style="padding: 8px 0; color: #6b7280;">
            Seats
          </td>
          <td
            style="
              padding: 8px 0;
              text-align: right;
              font-weight: bold;
            "
          >
            ${seats}
          </td>
        </tr>
      </table>

      <div
        style="
          margin-top: 25px;
          padding: 18px;
          background-color: #f3f4f6;
          border-radius: 8px;
          text-align: center;
        "
      >
        <span
          style="
            display: block;
            color: #6b7280;
            font-size: 14px;
          "
        >
          ${amountLabel}
        </span>

        <strong
          style="
            display: block;
            margin-top: 5px;
            font-size: 24px;
          "
        >
          ₹${amount}
        </strong>
      </div>

      <p
        style="
          margin-top: 25px;
          color: #4b5563;
          line-height: 1.6;
        "
      >
        ${finalMessage}
      </p>
    </div>

    <div
      style="
        background-color: #f9fafb;
        padding: 20px;
        text-align: center;
        color: #6b7280;
        font-size: 13px;
      "
    >
      <p style="margin: 0;">
        Thank you for using
        <strong>Movie Booking System</strong>.
      </p>

      <p style="margin: 8px 0 0;">
        This is an automated email. Please do not reply.
      </p>
    </div>
  </div>
</body>
</html>
`.trim();
}

export async function sendBookingConfirmationEmail(
  data: BookingEmailData
): Promise<void> {
  const transporter =
    getTransporter();

  const from =
    getSenderEmail();

  await transporter.sendMail({
    from,
    to: data.to,

    subject:
      `Booking Confirmed - ${data.bookingReference}`,

    text: `
Your movie booking has been successfully confirmed.

Booking Reference: ${data.bookingReference}

Movie: ${data.movieName}
Theatre: ${data.theatreName}
Screen: ${data.screenName}

Date: ${data.showDate}
Time: ${data.showTime}

Seats: ${data.seats.join(", ")}

Total Amount: ₹${data.amount}

Thank you for booking with Movie Booking System.
    `.trim(),

    html:
      createEmailHtml(
        data,
        "confirmed"
      ),
  });
}

export async function sendBookingCancellationEmail(
  data: BookingEmailData
): Promise<void> {
  const transporter =
    getTransporter();

  const from =
    getSenderEmail();

  await transporter.sendMail({
    from,
    to: data.to,

    subject:
      `Booking Cancelled - ${data.bookingReference}`,

    text: `
Your movie booking has been cancelled.

Booking Reference: ${data.bookingReference}

Movie: ${data.movieName}
Theatre: ${data.theatreName}
Screen: ${data.screenName}

Date: ${data.showDate}
Time: ${data.showTime}

Seats: ${data.seats.join(", ")}

Booking Amount: ₹${data.amount}

If this booking was already paid, the refund process will be handled according to the payment/refund policy.

Movie Booking System
    `.trim(),

    html:
      createEmailHtml(
        data,
        "cancelled"
      ),
  });
}


export async function sendBookingReminderEmail(
  data: BookingEmailData
): Promise<void> {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: getSenderEmail(),
    to: data.to,
    subject: `Reminder: Upcoming movie show - ${data.bookingReference}`,
    text: `
Your movie show is coming up!

Booking Reference: ${data.bookingReference}
Movie: ${data.movieName}
Theatre: ${data.theatreName}
Screen: ${data.screenName}
Date: ${data.showDate}
Time: ${data.showTime}
Seats: ${data.seats.join(", ")}

Please arrive at the theatre on time.

Movie Booking System
    `.trim(),
    html: createEmailHtml(data, "confirmed"),
  });
}

export async function sendShowtimeChangedEmail(
  data: BookingEmailData,
  previousShowTime: string
): Promise<void> {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: getSenderEmail(),
    to: data.to,
    subject: `Important: Showtime changed - ${data.bookingReference}`,
    text: `
Your movie showtime has changed.

Booking Reference: ${data.bookingReference}
Movie: ${data.movieName}
Theatre: ${data.theatreName}
Screen: ${data.screenName}
Previous Showtime: ${previousShowTime}
New Date: ${data.showDate}
New Showtime: ${data.showTime}
Seats: ${data.seats.join(", ")}

Please check your updated booking details before travelling.

Movie Booking System
    `.trim(),
  });
}
