"""Public pages the live feed is allowed to read.

These are works of the United States government and are in the public domain.
The fetcher still checks robots.txt before each request. Add a page here only
when its terms allow this app to send passages to the model.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class WebSource:
    id: str
    url: str
    publisher: str


WEB_SOURCES: list[WebSource] = [
    WebSource(
        id="usa-election-day",
        url="https://www.usa.gov/election-day",
        publisher="USA.gov",
    ),
    WebSource(
        id="usa-voter-id",
        url="https://www.usa.gov/voter-id",
        publisher="USA.gov",
    ),
    WebSource(
        id="fec-deadlines",
        url="https://www.fec.gov/help-candidates-and-committees/dates-and-deadlines/",
        publisher="Federal Election Commission",
    ),
]
