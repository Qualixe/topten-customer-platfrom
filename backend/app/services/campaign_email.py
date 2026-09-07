"""TopTen's own campaign email layout — Mailchimp is only ever handed the
final rendered HTML as a delivery target, never designs it. An admin's
campaign body is plain content (their own HTML fragment, personalization
tokens included); this module substitutes those tokens and wraps the
result in one shared, branded layout (logo + footer) before it's sent, so
every campaign email looks consistent regardless of what the admin wrote.

Branding (company name/logo) is read from the same settings other
customer-facing surfaces already use — `BirthdaySettings.company_name`
(the closest existing "our brand name" setting) and the site logo
(`SiteSettings.logo_path`, same file `SiteLogoHeader` resolves on public
pages) — rather than introducing a new, separate "email branding" setting.
"""

from datetime import UTC, datetime
from html import escape
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.site_settings import SiteSettings
from app.services.birthday_wishes import get_or_create_birthday_settings
from app.services.sms_campaigns_personalization import render_message

DEFAULT_COMPANY_NAME = "TopTen"
_LOGO_HEIGHT_PX = 48


async def get_email_branding(db: AsyncSession) -> tuple[str, str | None]:
    """(company_name, company_logo_url) for the current send — `company_logo_url`
    is `None` when no logo has been uploaded (the layout falls back to the
    company name as text, same as `LogoMark` does on public pages)."""
    birthday_settings = await get_or_create_birthday_settings(db)
    company_name = (birthday_settings.company_name or "").strip() or DEFAULT_COMPANY_NAME

    site_settings = (await db.execute(select(SiteSettings))).scalars().first()
    company_logo = None
    if site_settings is not None and site_settings.logo_path:
        filename = Path(site_settings.logo_path).name
        company_logo = f"{settings.API_PUBLIC_BASE_URL.rstrip('/')}/branding/{filename}"
    return company_name, company_logo


def _logo_block(company_logo: str | None, company_name: str) -> str:
    if company_logo:
        return (
            f'<img src="{escape(company_logo)}" alt="{escape(company_name)}" '
            f'height="{_LOGO_HEIGHT_PX}" '
            f'style="height:{_LOGO_HEIGHT_PX}px;width:auto;border:0;display:inline-block;" />'
        )
    return (
        f'<span style="font-size:20px;font-weight:700;color:#111827;">'
        f"{escape(company_name)}</span>"
    )


def render_campaign_email(
    body_html: str,
    *,
    customer_name: str,
    profile_link: str,
    campaign_name: str,
    company_name: str,
    company_logo: str | None,
) -> str:
    """Substitutes the supported personalization tokens
    (`{{customer_name}}`, `{{profile_link}}`, `{{campaign_name}}`,
    `{{company_name}}`) into the admin-authored `body_html`, then wraps the
    result in TopTen's own branded layout. Built as an f-string, not
    `str.format`, specifically so arbitrary `{`/`}` characters an admin's
    HTML/CSS might contain (e.g. an inline `<style>` block) are never
    mistaken for format fields — they're substituted at Python's own
    string-interpolation step, before this function ever sees them."""
    substituted_body = render_message(
        body_html,
        customer_name=customer_name,
        profile_link=profile_link,
        campaign_name=campaign_name,
        company_name=company_name,
    )
    logo_html = _logo_block(company_logo, company_name)
    year = datetime.now(UTC).year

    body_style = (
        "margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;"
    )
    outer_table_style = "background-color:#f4f4f5;padding:24px 0;"
    inner_table_style = "background-color:#ffffff;border-radius:10px;overflow:hidden;"
    header_cell_style = "padding:24px 32px;text-align:center;border-bottom:1px solid #e5e7eb;"
    body_cell_style = "padding:32px;color:#111827;font-size:15px;line-height:1.6;"
    footer_cell_style = (
        "padding:20px 32px;background-color:#f9fafb;text-align:center;"
        "color:#9ca3af;font-size:12px;"
    )

    return f"""<!DOCTYPE html>
<html>
  <body style="{body_style}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="{outer_table_style}">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0"
                 style="{inner_table_style}">
            <tr>
              <td style="{header_cell_style}">
                {logo_html}
              </td>
            </tr>
            <tr>
              <td style="{body_cell_style}">
                {substituted_body}
              </td>
            </tr>
            <tr>
              <td style="{footer_cell_style}">
                &copy; {year} {escape(company_name)}. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""
