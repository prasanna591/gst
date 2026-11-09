import smtplib
from email.message import EmailMessage

from fastapi import HTTPException

from app.mail_config import APP_NAME, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USER


def send_mail(to, subject, body, attachment=None, filename=None):
    if SMTP_PASSWORD.startswith("PASTE"):
        raise HTTPException(500, "Email is not configured in this build")
    msg = EmailMessage()
    msg["From"] = f"{APP_NAME} <{SMTP_USER}>"
    msg["To"] = to if isinstance(to, str) else ", ".join(to)
    msg["Subject"] = subject
    msg.set_content(body)
    if attachment:
        msg.add_attachment(attachment, maintype="application", subtype="zip", filename=filename)
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as smtp:
            smtp.starttls()
            smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.send_message(msg)
    except Exception:
        raise HTTPException(502, "Could not send the email. Check the internet connection.")