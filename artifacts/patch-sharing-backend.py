from pathlib import Path
root=Path('E:/source_code/wechat/DiKongKong-Backend/src')
base=root/'main/java/com/example/dikongkongbackend/service'
def edit(p,old,new):
 s=p.read_text(encoding='utf-8');assert old in s,(str(p),old[:80]);p.write_text(s.replace(old,new),encoding='utf-8')
p=base/'LocationSharingService.java'
edit(p,'    public List<Participant> participants(User user, String sessionId) {\n        Session own',
'''    public List<Participant> participants(User user, String sessionId) {
        return enrichParticipants(participantSnapshots(user, sessionId));
    }

    // Fetch active coordinates first; view requests enrich only the roster/viewport union.
    public List<Participant> participantSnapshots(User user, String sessionId) {
        Session own''')
edit(p,'        // Retained locations must not retain obsolete profile pictures. Read current profile fields in one batch.',
'''        return participants;
    }

    public List<Participant> enrichParticipants(List<Participant> participants) {
        if (participants.isEmpty()) return List.of();
        // Retained locations must not retain obsolete profile pictures. Read current profile fields in one batch.''')
p=base/'LocationSharingViewService.java'
edit(p,'sharing.participants(user,sessionId)','sharing.participantSnapshots(user,sessionId)')
edit(p,'        return new View(roster,all.size(),page,from+100<all.size(),inMap,List.of(),"avatar");',
'''        Map<String, Participant> selected = new LinkedHashMap<>();
        roster.forEach(p -> selected.put(p.id(), p));
        inMap.forEach(p -> selected.put(p.id(), p));
        Map<String, Participant> current = new HashMap<>();
        sharing.enrichParticipants(new ArrayList<>(selected.values())).forEach(p -> current.put(p.id(), p));
        var currentRoster = roster.stream().map(p -> current.get(p.id())).filter(Objects::nonNull).toList();
        var currentMap = inMap.stream().map(p -> current.get(p.id())).filter(Objects::nonNull).toList();
        return new View(currentRoster,all.size(),page,from+100<all.size(),currentMap,List.of(),"avatar");''')
p=root/'test/java/com/example/dikongkongbackend/service/LocationSharingViewServiceTest.java'
edit(p,'sharing.participants(', 'sharing.participantSnapshots(')
s=p.read_text(encoding='utf-8');pos=s.index('    @Test')
s=s[:pos]+'''    @org.junit.jupiter.api.BeforeEach void enrichment() {
        lenient().when(sharing.enrichParticipants(anyList())).thenAnswer(a -> a.getArgument(0));
    }
    @Test void onlyEnrichesVisibleAndRosterUsersOnce() {
        when(sharing.participantSnapshots(user,"session")).thenReturn(people(1200));
        var result = service.view(user,"session",new ViewRequest(0,"avatar","all",33.,119.,34.,121.));
        assertEquals(1200, result.total());
        assertTrue(result.mapParticipants().isEmpty());
        verify(sharing).enrichParticipants(argThat(rows -> rows.size() == 100));
    }
'''+s[pos:];p.write_text(s,encoding='utf-8')
print('Backend hydrates only selected participant union; all-avatar display retained.')
