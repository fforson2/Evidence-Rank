"""Public-domain and CC0 photographs shown with live claims.

The allowlisted pages do not include article photos. These stills are separate
works whose terms allow display. A claim keeps the same picture because the
choice is derived from its id.
"""

from dataclasses import dataclass
import hashlib


@dataclass(frozen=True)
class Picture:
    url: str
    credit: str


PICTURES: tuple[Picture, ...] = (
    Picture(
        url=(
            "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/"
            "President_Truman_and_his_family_cast_their_ballots_%2854090743419%29.jpg/"
            "960px-President_Truman_and_his_family_cast_their_ballots_%2854090743419%29.jpg"
        ),
        credit="President Truman and his family cast their ballots. Public-domain U.S. government photograph.",
    ),
    Picture(
        url=(
            "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/"
            "World_War_2_US_Soldier_voting_information_poster%2C_1944.jpg/"
            "960px-World_War_2_US_Soldier_voting_information_poster%2C_1944.jpg"
        ),
        credit="World War II voting information poster, 1944. Public domain.",
    ),
    Picture(
        url="https://upload.wikimedia.org/wikipedia/commons/3/37/Afghan_man_at_the_ballot_box_during_Loya_jirga.jpg",
        credit="A voter at a ballot box during a Loya Jirga. Public-domain photograph.",
    ),
    Picture(
        url=(
            "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/"
            "Urne_Ballot_box_r%C3%A9publique.jpg/960px-Urne_Ballot_box_r%C3%A9publique.jpg"
        ),
        credit="Ballot box. CC0 photograph.",
    ),
)


def picture_for(post_id: str) -> Picture:
    slot = int(hashlib.sha256(post_id.encode()).hexdigest()[:8], 16) % len(PICTURES)
    return PICTURES[slot]
