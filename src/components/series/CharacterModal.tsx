"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { gql } from "@/lib/anilist";
import { stripHtml } from "@/lib/format";

interface CharacterDetail {
  id: number;
  name: { full: string; native?: string; alternative?: string[] };
  image?: { large?: string };
  description?: string;
  age?: string;
  gender?: string;
  bloodType?: string;
  dateOfBirth?: { month?: number; day?: number };
  media: {
    nodes: {
      id: number;
      type: string;
      title: { romaji?: string; english?: string };
      coverImage?: { medium?: string };
    }[];
  };
}

const QUERY = `
query ($id: Int) {
  Character(id: $id) {
    id
    name { full native alternative }
    image { large }
    description(asHtml: false)
    age
    gender
    bloodType
    dateOfBirth { month day }
    media(perPage: 6, sort: POPULARITY_DESC) {
      nodes { id type title { romaji english } coverImage { medium } }
    }
  }
}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function CharacterModal({
  characterId,
  onClose,
}: {
  characterId: number | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["character", characterId],
    enabled: characterId != null,
    staleTime: Infinity,
    queryFn: async () => {
      const res = await gql<{ Character: CharacterDetail }>(QUERY, { id: characterId });
      return res.Character;
    },
  });

  const facts: [string, string | undefined][] = data
    ? [
        ["Age", data.age],
        ["Gender", data.gender],
        ["Blood type", data.bloodType],
        [
          "Birthday",
          data.dateOfBirth?.month
            ? `${MONTHS[data.dateOfBirth.month - 1]} ${data.dateOfBirth.day ?? ""}`.trim()
            : undefined,
        ],
      ]
    : [];

  return (
    <Modal
      open={characterId != null}
      onClose={onClose}
      title={
        data ? (
          <span>
            {data.name.full}
            {data.name.native && (
              <span className="ml-2 text-sm font-normal text-muted">
                {data.name.native}
              </span>
            )}
          </span>
        ) : (
          "Character"
        )
      }
      wide
    >
      {isLoading || !data ? (
        <div className="flex gap-5">
          <Skeleton className="h-56 w-40 shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 sm:flex-row">
          {data.image?.large && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.image.large}
              alt={data.name.full}
              className="h-64 w-44 shrink-0 self-start rounded-xl border border-line object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
              {facts
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <span key={k}>
                    <span className="text-faint">{k}: </span>
                    <span className="text-text">{v}</span>
                  </span>
                ))}
            </div>
            {data.description && (
              <p className="mt-3 max-h-64 overflow-y-auto whitespace-pre-line pr-2 text-sm leading-relaxed text-text/85">
                {stripHtml(data.description).replace(/~!|!~/g, "")}
              </p>
            )}
            {!!data.media.nodes.length && (
              <>
                <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-widest text-faint">
                  Appears in
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.media.nodes.map((m) => (
                    <Link
                      key={m.id}
                      href={`/series/${m.id}`}
                      onClick={onClose}
                      className="flex items-center gap-2 rounded-lg border border-line bg-ink-800 py-1 pl-1 pr-3 text-xs transition-colors hover:border-vermillion/60"
                    >
                      {m.coverImage?.medium && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.coverImage.medium}
                          alt=""
                          className="h-9 w-6 rounded object-cover"
                        />
                      )}
                      <span className="max-w-40 truncate">
                        {m.title.english || m.title.romaji}
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
